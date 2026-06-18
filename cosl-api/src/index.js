import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const db = new Pool({ connectionString: process.env.DATABASE_URL });

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
});

await app.register(jwt, { secret: process.env.JWT_SECRET });

app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Non autorisé' });
  }
});

// ─────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────
app.post('/auth/token', async (req, reply) => {
  const { secret } = req.body;
  if (secret !== process.env.JWT_SECRET) {
    return reply.status(403).send({ error: 'Accès refusé' });
  }
  const token = app.jwt.sign({ role: 'api_client' }, { expiresIn: '30d' });
  return { token };
});

// ─────────────────────────────────────────────────────────
// ATHLETES
// ─────────────────────────────────────────────────────────
app.get('/athletes', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { status, federation_id, limit = 50, offset = 0 } = req.query;
  let query = `
    SELECT a.id, a.cosl_id, a.first_name, a.last_name, a.gender,
           a.birth_date, a.status, a.level, a.photo_url,
           a.email, a.phone,
           f.acronym as federation_acronym, f.name as federation_name,
           c.name as club_name,
           s.name as sport_name,
           k.global_status as kyc_status
    FROM athletes a
    LEFT JOIN federations f ON f.id = a.primary_federation_id
    LEFT JOIN clubs c ON c.id = a.current_club_id
    LEFT JOIN sports s ON s.id = a.primary_sport_id
    LEFT JOIN athlete_kyc k ON k.athlete_id = a.id
    WHERE a.is_active = true
  `;
  const params = [];
  if (status) { params.push(status); query += ` AND a.status = $${params.length}`; }
  if (federation_id) { params.push(federation_id); query += ` AND a.primary_federation_id = $${params.length}`; }
  params.push(limit, offset);
  query += ` ORDER BY a.last_name LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const result = await db.query(query, params);
  return { data: result.rows, count: result.rowCount };
});

app.get('/athletes/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(
    `SELECT a.*, f.name as federation_name, c.name as club_name, s.name as sport_name
     FROM athletes a
     LEFT JOIN federations f ON f.id = a.primary_federation_id
     LEFT JOIN clubs c ON c.id = a.current_club_id
     LEFT JOIN sports s ON s.id = a.primary_sport_id
     WHERE a.id = $1`,
    [req.params.id]
  );
  if (!rows.length) return reply.status(404).send({ error: 'Athlète introuvable' });
  return rows[0];
});

// ─────────────────────────────────────────────────────────
// FEDERATIONS
// ─────────────────────────────────────────────────────────
app.get('/federations', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT f.*,
           COUNT(DISTINCT c.id) as clubs_count,
           COUNT(DISTINCT a.id) as athletes_count
    FROM federations f
    LEFT JOIN clubs c ON c.federation_id = f.id
    LEFT JOIN athletes a ON a.primary_federation_id = f.id AND a.is_active = true
    GROUP BY f.id
    ORDER BY f.acronym
  `);
  return { data: rows };
});

app.get('/federations/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`SELECT * FROM federations WHERE id = $1`, [req.params.id]);
  if (!rows.length) return reply.status(404).send({ error: 'Fédération introuvable' });

  const { rows: clubs } = await db.query(
    `SELECT id, name, city, logo_url FROM clubs WHERE federation_id = $1 ORDER BY name`,
    [req.params.id]
  );

  return { ...rows[0], clubs };
});

app.get('/federations/:id/members', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT fm.*
    FROM federation_members fm
    WHERE fm.federation_id = $1
    ORDER BY fm.last_name, fm.first_name
  `, [req.params.id]);
  return { data: rows };
});

// ─────────────────────────────────────────────────────────
// CLUBS
// ─────────────────────────────────────────────────────────
app.get('/clubs', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { federation_id, limit = 100, offset = 0 } = req.query;
  let query = `
    SELECT c.*,
           f.acronym as federation_acronym, f.name as federation_name,
           COUNT(DISTINCT cm.id) as members_count,
           COUNT(DISTINCT a.id) as athletes_count
    FROM clubs c
    LEFT JOIN federations f ON f.id = c.federation_id
    LEFT JOIN club_members cm ON cm.club_id = c.id AND cm.is_active = true
    LEFT JOIN athletes a ON a.current_club_id = c.id AND a.is_active = true
    WHERE 1=1
  `;
  const params = [];
  if (federation_id) { params.push(federation_id); query += ` AND c.federation_id = $${params.length}`; }
  query += ` GROUP BY c.id, f.acronym, f.name ORDER BY c.name`;
  params.push(limit, offset);
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await db.query(query, params);
  return { data: rows };
});

app.get('/clubs/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT c.*, f.acronym as federation_acronym, f.name as federation_name
    FROM clubs c
    LEFT JOIN federations f ON f.id = c.federation_id
    WHERE c.id = $1
  `, [req.params.id]);
  if (!rows.length) return reply.status(404).send({ error: 'Club introuvable' });

  const { rows: members } = await db.query(
    `SELECT id, first_name, last_name, role, email, phone, photo_url, is_active
     FROM club_members WHERE club_id = $1 ORDER BY last_name, first_name`,
    [req.params.id]
  );

  const { rows: athletes } = await db.query(
    `SELECT id, cosl_id, first_name, last_name, photo_url, status, level
     FROM athletes WHERE current_club_id = $1 AND is_active = true ORDER BY last_name`,
    [req.params.id]
  );

  return { ...rows[0], members, athletes };
});

app.get('/clubs/:id/members', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT cm.*
    FROM club_members cm
    WHERE cm.club_id = $1
    ORDER BY cm.last_name, cm.first_name
  `, [req.params.id]);
  return { data: rows };
});

// ─────────────────────────────────────────────────────────
// COACHES
// ─────────────────────────────────────────────────────────
app.get('/coaches', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { federation_id, club_id, limit = 100, offset = 0 } = req.query;
  let query = `
    SELECT co.*,
           f.acronym as federation_acronym, f.name as federation_name,
           cl.name as club_name
    FROM coaches co
    LEFT JOIN federations f ON f.id = co.federation_id
    LEFT JOIN clubs cl ON cl.id = co.club_id
    WHERE 1=1
  `;
  const params = [];
  if (federation_id) { params.push(federation_id); query += ` AND co.federation_id = $${params.length}`; }
  if (club_id) { params.push(club_id); query += ` AND co.club_id = $${params.length}`; }
  query += ` ORDER BY co.last_name, co.first_name`;
  params.push(limit, offset);
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await db.query(query, params);
  return { data: rows };
});

app.get('/coaches/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT co.*,
           f.acronym as federation_acronym, f.name as federation_name,
           cl.name as club_name
    FROM coaches co
    LEFT JOIN federations f ON f.id = co.federation_id
    LEFT JOIN clubs cl ON cl.id = co.club_id
    WHERE co.id = $1
  `, [req.params.id]);
  if (!rows.length) return reply.status(404).send({ error: 'Coach introuvable' });
  return rows[0];
});

// ─────────────────────────────────────────────────────────
// PERSONS (référentiel central)
// ─────────────────────────────────────────────────────────
app.get('/persons', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { role_type, is_active, limit = 100, offset = 0 } = req.query;
  let query = `
    SELECT p.id, p.first_name, p.last_name, p.birth_date, p.gender,
           p.nationality, p.email, p.phone, p.photo_url, p.is_active,
           ARRAY_AGG(DISTINCT pr.role_type) FILTER (WHERE pr.role_type IS NOT NULL) as roles
    FROM persons p
    LEFT JOIN person_roles pr ON pr.person_id = p.id AND pr.is_active = true
    WHERE 1=1
  `;
  const params = [];
  if (is_active !== undefined) { params.push(is_active === 'true'); query += ` AND p.is_active = $${params.length}`; }
  query += ` GROUP BY p.id`;
  if (role_type) { params.push(role_type); query += ` HAVING $${params.length} = ANY(ARRAY_AGG(DISTINCT pr.role_type))`; }
  query += ` ORDER BY p.last_name, p.first_name`;
  params.push(limit, offset);
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await db.query(query, params);
  return { data: rows };
});

app.get('/persons/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`SELECT * FROM persons WHERE id = $1`, [req.params.id]);
  if (!rows.length) return reply.status(404).send({ error: 'Personne introuvable' });

  const { rows: roles } = await db.query(
    `SELECT role_type, is_active FROM person_roles WHERE person_id = $1`,
    [req.params.id]
  );

  return { ...rows[0], roles };
});

// ─────────────────────────────────────────────────────────
// GAMES
// ─────────────────────────────────────────────────────────
app.get('/games', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { status } = req.query;
  let query = `SELECT * FROM games`;
  const params = [];
  if (status) { params.push(status); query += ` WHERE status = $1`; }
  query += ` ORDER BY competition_start DESC`;
  const { rows } = await db.query(query, params);
  return { data: rows };
});

app.get('/games/:id/selections', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT s.*,
           a.first_name, a.last_name, a.cosl_id, a.gender, a.photo_url,
           sp.name as sport_name,
           d.name as discipline_name
    FROM selections s
    JOIN athletes a ON a.id = s.athlete_id
    LEFT JOIN sports sp ON sp.id = s.sport_id
    LEFT JOIN disciplines d ON d.id = s.discipline_id
    WHERE s.game_id = $1
    ORDER BY a.last_name
  `, [req.params.id]);
  return { data: rows };
});

// ─────────────────────────────────────────────────────────
// ACCREDITATIONS
// ─────────────────────────────────────────────────────────
app.get('/accreditations', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { game_id, status, limit = 100, offset = 0 } = req.query;
  let query = `
    SELECT acc.*,
           at.category, at.type_code,
           a.first_name as athlete_first_name, a.last_name as athlete_last_name, a.cosl_id,
           co.first_name as coach_first_name, co.last_name as coach_last_name
    FROM accreditations acc
    JOIN accreditation_types at ON at.id = acc.accreditation_type_id
    LEFT JOIN athletes a ON a.id = acc.athlete_id
    LEFT JOIN coaches co ON co.id = acc.coach_id
    WHERE 1=1
  `;
  const params = [];
  if (game_id) { params.push(game_id); query += ` AND acc.game_id = $${params.length}`; }
  if (status) { params.push(status); query += ` AND acc.status = $${params.length}`; }
  query += ` ORDER BY acc.full_name`;
  params.push(limit, offset);
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await db.query(query, params);
  return { data: rows };
});

app.get('/accreditations/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT acc.*,
           at.category, at.type_code, at.description as type_description
    FROM accreditations acc
    JOIN accreditation_types at ON at.id = acc.accreditation_type_id
    WHERE acc.id = $1
  `, [req.params.id]);
  if (!rows.length) return reply.status(404).send({ error: 'Accréditation introuvable' });

  const { rows: documents } = await db.query(
    `SELECT * FROM accreditation_documents WHERE accreditation_id = $1`,
    [req.params.id]
  );

  return { ...rows[0], documents };
});

// ─────────────────────────────────────────────────────────
// DELEGATIONS
// ─────────────────────────────────────────────────────────
app.get('/delegations/:game_id', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT d.*,
           p1.first_name as chief_first_name, p1.last_name as chief_last_name
    FROM delegations d
    LEFT JOIN persons p1 ON p1.id = d.chief_of_mission_id
    WHERE d.game_id = $1
  `, [req.params.game_id]);
  if (!rows.length) return reply.status(404).send({ error: 'Délégation introuvable pour ce Games' });

  const { rows: members } = await db.query(`
    SELECT dm.*,
           a.first_name as athlete_first_name, a.last_name as athlete_last_name, a.cosl_id, a.photo_url as athlete_photo_url,
           co.first_name as coach_first_name, co.last_name as coach_last_name, co.photo_url as coach_photo_url
    FROM delegation_members dm
    LEFT JOIN athletes a ON a.id = dm.athlete_id
    LEFT JOIN coaches co ON co.id = dm.coach_id
    WHERE dm.delegation_id = $1
    ORDER BY dm.member_role
  `, [rows[0].id]);

  return { ...rows[0], members };
});

// ─────────────────────────────────────────────────────────
// LOGISTICS - TRAVEL PLANS / FLIGHTS / ACCOMMODATIONS
// ─────────────────────────────────────────────────────────
app.get('/travel-plans', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { game_id, limit = 100, offset = 0 } = req.query;
  let query = `
    SELECT tp.*,
           s.name as sport_name
    FROM travel_plans tp
    LEFT JOIN sports s ON s.id = tp.sport_id
    WHERE 1=1
  `;
  const params = [];
  if (game_id) { params.push(game_id); query += ` AND tp.game_id = $${params.length}`; }
  query += ` ORDER BY tp.departure_date`;
  params.push(limit, offset);
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await db.query(query, params);
  return { data: rows };
});

app.get('/travel-plans/:id', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`SELECT * FROM travel_plans WHERE id = $1`, [req.params.id]);
  if (!rows.length) return reply.status(404).send({ error: 'Plan de voyage introuvable' });

  const { rows: flights } = await db.query(
    `SELECT * FROM flights WHERE travel_plan_id = $1 ORDER BY departure_time`,
    [req.params.id]
  );

  return { ...rows[0], flights };
});

app.get('/accommodations', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { game_id, limit = 100, offset = 0 } = req.query;
  let query = `SELECT * FROM accommodations WHERE 1=1`;
  const params = [];
  if (game_id) { params.push(game_id); query += ` AND game_id = $${params.length}`; }
  query += ` ORDER BY name`;
  params.push(limit, offset);
  query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await db.query(query, params);
  return { data: rows };
});

app.get('/accommodations/:id/rooming', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT ra.*,
           a.first_name as athlete_first_name, a.last_name as athlete_last_name, a.cosl_id,
           co.first_name as coach_first_name, co.last_name as coach_last_name
    FROM rooming_assignments ra
    LEFT JOIN athletes a ON a.id = ra.athlete_id
    LEFT JOIN coaches co ON co.id = ra.coach_id
    WHERE ra.accommodation_id = $1
    ORDER BY ra.room_number
  `, [req.params.id]);
  return { data: rows };
});

// ─────────────────────────────────────────────────────────
// SPONSORS / PARTNERS
// ─────────────────────────────────────────────────────────
app.get('/sponsors', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT s.*, sr.name as rank_name
    FROM sponsors s
    LEFT JOIN sponsor_ranks sr ON sr.id = s.rank_id
    WHERE s.is_active = true
    ORDER BY s.name
  `);
  return { data: rows };
});

app.get('/partners', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT * FROM partners WHERE is_active = true ORDER BY name
  `);
  return { data: rows };
});

// ─────────────────────────────────────────────────────────
// KYC
// ─────────────────────────────────────────────────────────
app.get('/kyc/summary', { onRequest: [app.authenticate] }, async (req, reply) => {
  const { rows } = await db.query(`
    SELECT global_status, COUNT(*) as count
    FROM athlete_kyc
    GROUP BY global_status
  `);
  return { data: rows };
});

// ─────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

await app.listen({ port: parseInt(process.env.PORT ?? '3004'), host: '0.0.0.0' });

// Historical Sites runtime is retired; only Node + Google OIDC + Northflank PostgreSQL is supported.
export default { fetch() { return Response.json({ error: 'Ez a korábbi futtatási mód megszűnt. A Northflank Node-alkalmazást használd.' }, { status: 503 }); } };

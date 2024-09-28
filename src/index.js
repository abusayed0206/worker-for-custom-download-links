export default {
  async fetch(request, env, ctx) {
    return await handleRequest(request, env);
  },
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const pathSegments = url.pathname
    .split("/")
    .filter((segment) => segment !== "");
  const tmdb_id = pathSegments[0];
  const action = pathSegments[1];

  if (!tmdb_id) {
    return new Response("TMDB ID is required", { status: 400 });
  }

  if (request.method === "GET") {
    return await getData(tmdb_id, env);
  } else if (request.method === "POST" && action === "edit") {
    const data = await request.json();
    return await updateData(tmdb_id, data, env);
  } else {
    return new Response("Method not allowed", { status: 405 });
  }
}s

async function getData(tmdb_id, env) {
  if (!tmdb_id) {
    return new Response("TMDB ID is required", { status: 400 });
  }

  // Try to get data from KV first
  let data = await env.MDBD.get(tmdb_id, "json");

  if (!data) {
    // If not in KV, check D1
    const stmt = env.D1_DB.prepare("SELECT * FROM MDBD WHERE TMDB_ID = ?").bind(
      tmdb_id
    );
    const result = await stmt.first();

    if (result) {
      data = { TMDB_ID: result.TMDB_ID, FDL: result.FDL, PDL: result.PDL };
      // Save to KV for future quick access
      await env.MDBD.put(tmdb_id, JSON.stringify(data));
    } else {
      return new Response("Data not found", { status: 404 });
    }
  }

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}

async function updateData(tmdb_id, data, env) {
  if (!tmdb_id) {
    return new Response("TMDB ID is required", { status: 400 });
  }

  // Update or insert data in D1
  const stmt = env.D1_DB.prepare(
    "INSERT OR REPLACE INTO MDBD (TMDB_ID, FDL, PDL) VALUES (?, ?, ?)"
  );
  await stmt.bind(tmdb_id, data.FDL, data.PDL).run();

  // Update KV
  await env.MDBD.put(tmdb_id, JSON.stringify(data));

  return new Response(
    JSON.stringify({ message: "Data updated successfully" }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}

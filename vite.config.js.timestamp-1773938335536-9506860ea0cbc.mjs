var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server/qualify.js
import OpenAI from "file:///sessions/ecstatic-busy-dijkstra/mnt/nexap/node_modules/openai/index.mjs";
async function qualifyLeadServer(lead) {
  console.log("[QUALIFY] D\xE9but de qualification pour:", {
    nom: lead.nom,
    email: lead.email,
    budget: lead.budget,
    typeBien: lead.typeBien
  });
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("[QUALIFY] V\xE9rification de la cl\xE9 API:", {
    hasOpenAIKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 7) + "..." : "N/A"
  });
  if (!apiKey || apiKey === "REMPLACER_PAR_NOUVELLE_CLE") {
    const errorMsg = "OPENAI_API_KEY non configur\xE9e. Ajoutez-la dans .env (local) et Vercel Dashboard > Environment Variables (production)";
    console.error("[QUALIFY] ERREUR:", errorMsg);
    throw new Error(errorMsg);
  }
  let client;
  try {
    console.log("[QUALIFY] Initialisation du client OpenAI...");
    client = new OpenAI({
      apiKey
    });
    console.log("[QUALIFY] Client OpenAI initialis\xE9 avec succ\xE8s");
  } catch (error) {
    console.error("[QUALIFY] ERREUR lors de l'initialisation du client OpenAI:", error);
    throw new Error(`Erreur d'initialisation OpenAI: ${error.message}`);
  }
  const prompt = `
Tu es un expert immobilier.
Analyse ce prospect et retourne STRICTEMENT ce JSON :

{
  "score": number (0-100),
  "niveau": "chaud" | "ti\xE8de" | "froid",
  "raison": "courte analyse",
  "action": "action recommand\xE9e"
}

Donn\xE9es :
${JSON.stringify(lead, null, 2)}
`;
  try {
    console.log("[QUALIFY] Appel \xE0 l'API OpenAI...");
    console.log("[QUALIFY] Donn\xE9es envoy\xE9es:", JSON.stringify(lead, null, 2));
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });
    console.log("[QUALIFY] R\xE9ponse OpenAI re\xE7ue:", {
      hasContent: !!response?.choices?.[0]?.message?.content,
      contentLength: response?.choices?.[0]?.message?.content?.length || 0
    });
    if (!response?.choices?.[0]?.message?.content) {
      throw new Error("R\xE9ponse OpenAI vide - aucune r\xE9ponse g\xE9n\xE9r\xE9e");
    }
    const rawContent = response.choices[0].message.content;
    console.log("[QUALIFY] Contenu brut de la r\xE9ponse:", rawContent.substring(0, 200) + "...");
    let qualification;
    try {
      qualification = JSON.parse(rawContent);
      console.log("[QUALIFY] JSON pars\xE9 avec succ\xE8s:", qualification);
    } catch (parseError) {
      console.error("[QUALIFY] ERREUR lors du parsing JSON:", parseError);
      console.error("[QUALIFY] Contenu qui a \xE9chou\xE9:", rawContent);
      throw new Error(`R\xE9ponse OpenAI invalide (JSON non valide): ${parseError.message}`);
    }
    if (typeof qualification.score !== "number" && typeof qualification.score !== "string") {
      throw new Error('Le champ "score" est manquant ou invalide dans la r\xE9ponse OpenAI');
    }
    if (!qualification.niveau) {
      throw new Error('Le champ "niveau" est manquant dans la r\xE9ponse OpenAI');
    }
    const normalizedScore = Math.max(0, Math.min(100, parseInt(qualification.score) || 0));
    const normalizedNiveau = ["chaud", "ti\xE8de", "froid"].includes(qualification.niveau?.toLowerCase()) ? qualification.niveau.toLowerCase() : null;
    if (!normalizedNiveau) {
      throw new Error(`Niveau invalide: ${qualification.niveau}. Attendu: chaud, ti\xE8de ou froid`);
    }
    const result = {
      score: normalizedScore,
      niveau: normalizedNiveau,
      raison: qualification.raison || "Analyse effectu\xE9e",
      action: qualification.action || "Contacter le prospect"
    };
    console.log("[QUALIFY] Qualification r\xE9ussie:", result);
    return result;
  } catch (error) {
    console.error("[QUALIFY] ERREUR lors de l'appel OpenAI:", error);
    console.error("[QUALIFY] Stack trace:", error.stack);
    throw new Error(`Erreur de qualification IA: ${error.message || "Erreur inconnue"}`);
  }
}
var init_qualify = __esm({
  "src/server/qualify.js"() {
  }
});

// src/server/index.js
var server_exports = {};
__export(server_exports, {
  handleQualify: () => handleQualify
});
async function handleQualify(req) {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: true,
          message: "M\xE9thode non autoris\xE9e. Utilisez POST."
        }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Corps de la requ\xEAte invalide (JSON attendu)"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Donn\xE9es invalides"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    console.log("[API] Appel de qualifyLeadServer avec:", {
      nom: body.nom,
      email: body.email,
      budget: body.budget
    });
    let result;
    try {
      result = await qualifyLeadServer(body);
      console.log("[API] Qualification r\xE9ussie:", result);
    } catch (qualifyError) {
      console.error("[API] Erreur lors de la qualification:", qualifyError);
      return new Response(
        JSON.stringify({
          error: true,
          message: qualifyError.message || "Erreur lors de la qualification",
          details: qualifyError.stack
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("[API] Erreur critique dans handleQualify:", error);
    console.error("[API] Stack trace:", error.stack);
    return new Response(
      JSON.stringify({
        error: true,
        message: `Erreur technique: ${error.message || "Erreur inconnue"}`,
        details: error.stack
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
var init_server = __esm({
  "src/server/index.js"() {
    init_qualify();
  }
});

// vite.config.js
import { defineConfig, loadEnv } from "file:///sessions/ecstatic-busy-dijkstra/mnt/nexap/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/ecstatic-busy-dijkstra/mnt/nexap/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isDev = mode === "development";
  return {
    plugins: [
      react(),
      // Middleware local /api/qualify — uniquement en développement (vite dev)
      // En production Vercel, c'est pages/api/qualify.js qui prend le relai
      isDev && {
        name: "api-qualify",
        async configureServer(server) {
          let handleQualify2;
          try {
            const mod = await Promise.resolve().then(() => (init_server(), server_exports));
            handleQualify2 = mod.handleQualify;
          } catch (e) {
            console.warn("[VITE] Impossible de charger le serveur qualify:", e.message);
            return;
          }
          if (env.VITE_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = env.VITE_OPENAI_API_KEY;
          }
          if (env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
          }
          server.middlewares.use("/api/qualify", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: true, message: "M\xE9thode non autoris\xE9e. Utilisez POST." }));
              return;
            }
            try {
              let body = "";
              req.on("data", (chunk) => {
                body += chunk.toString();
              });
              req.on("end", async () => {
                try {
                  const parsedBody = body ? JSON.parse(body) : {};
                  const requestLike = { method: req.method, json: async () => parsedBody, headers: req.headers };
                  const response = await handleQualify2(requestLike);
                  res.statusCode = response.status;
                  response.headers.forEach((value, key) => {
                    res.setHeader(key, value);
                  });
                  res.end(await response.text());
                } catch (error) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: true, message: error.message }));
                }
              });
            } catch (error) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: true, message: error.message }));
            }
          });
        }
      }
    ].filter(Boolean),
    server: {
      port: 5173,
      open: true
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL3NlcnZlci9xdWFsaWZ5LmpzIiwgInNyYy9zZXJ2ZXIvaW5kZXguanMiLCAidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZWNzdGF0aWMtYnVzeS1kaWprc3RyYS9tbnQvbmV4YXAvc3JjL3NlcnZlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2Vjc3RhdGljLWJ1c3ktZGlqa3N0cmEvbW50L25leGFwL3NyYy9zZXJ2ZXIvcXVhbGlmeS5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvZWNzdGF0aWMtYnVzeS1kaWprc3RyYS9tbnQvbmV4YXAvc3JjL3NlcnZlci9xdWFsaWZ5LmpzXCI7aW1wb3J0IE9wZW5BSSBmcm9tIFwib3BlbmFpXCJcblxuLyoqXG4gKiBRdWFsaWZpY2F0aW9uIGQndW4gbGVhZCB2aWEgT3BlbkFJXG4gKiBORSBSRVRPVVJORSBKQU1BSVMgZGUgZmFsbGJhY2sgc2lsZW5jaWV1eFxuICogTGFuY2UgdW5lIGVycmV1ciBzaSBPcGVuQUkgbidlc3QgcGFzIGNvbmZpZ3VyXHUwMEU5IG91IGVuIGNhcyBkJ1x1MDBFOWNoZWNcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHF1YWxpZnlMZWFkU2VydmVyKGxlYWQpIHtcbiAgLy8gTG9nIGRlcyBkb25uXHUwMEU5ZXMgcmVcdTAwRTd1ZXNcbiAgY29uc29sZS5sb2coJ1tRVUFMSUZZXSBEXHUwMEU5YnV0IGRlIHF1YWxpZmljYXRpb24gcG91cjonLCB7XG4gICAgbm9tOiBsZWFkLm5vbSxcbiAgICBlbWFpbDogbGVhZC5lbWFpbCxcbiAgICBidWRnZXQ6IGxlYWQuYnVkZ2V0LFxuICAgIHR5cGVCaWVuOiBsZWFkLnR5cGVCaWVuXG4gIH0pXG5cbiAgLy8gVlx1MDBFOXJpZmllciBsYSBwclx1MDBFOXNlbmNlIGRlIGxhIGNsXHUwMEU5IEFQSVxuICAvLyBcdTI3MDUgU1x1MDBDOUNVUklUXHUwMEM5IDogdW5pcXVlbWVudCBPUEVOQUlfQVBJX0tFWSAoc2FucyBwclx1MDBFOWZpeGUgVklURV8pXG4gIC8vIFZJVEVfT1BFTkFJX0FQSV9LRVkgaW50XHUwMEU5Z3JhaXQgbGEgY2xcdTAwRTkgZGFucyBsZSBKUyBwdWJsaWMgXHUyMDE0IHN1cHByaW1cdTAwRTlcbiAgY29uc3QgYXBpS2V5ID0gcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9LRVlcblxuICBjb25zb2xlLmxvZygnW1FVQUxJRlldIFZcdTAwRTlyaWZpY2F0aW9uIGRlIGxhIGNsXHUwMEU5IEFQSTonLCB7XG4gICAgaGFzT3BlbkFJS2V5OiAhIWFwaUtleSxcbiAgICBhcGlLZXlMZW5ndGg6IGFwaUtleSA/IGFwaUtleS5sZW5ndGggOiAwLFxuICAgIGFwaUtleVByZWZpeDogYXBpS2V5ID8gYXBpS2V5LnN1YnN0cmluZygwLCA3KSArICcuLi4nIDogJ04vQSdcbiAgfSlcblxuICBpZiAoIWFwaUtleSB8fCBhcGlLZXkgPT09ICdSRU1QTEFDRVJfUEFSX05PVVZFTExFX0NMRScpIHtcbiAgICBjb25zdCBlcnJvck1zZyA9ICdPUEVOQUlfQVBJX0tFWSBub24gY29uZmlndXJcdTAwRTllLiBBam91dGV6LWxhIGRhbnMgLmVudiAobG9jYWwpIGV0IFZlcmNlbCBEYXNoYm9hcmQgPiBFbnZpcm9ubWVudCBWYXJpYWJsZXMgKHByb2R1Y3Rpb24pJ1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tRVUFMSUZZXSBFUlJFVVI6JywgZXJyb3JNc2cpXG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9yTXNnKVxuICB9XG5cbiAgLy8gSW5pdGlhbGlzZXIgbGUgY2xpZW50IE9wZW5BSVxuICBsZXQgY2xpZW50XG4gIHRyeSB7XG4gICAgY29uc29sZS5sb2coJ1tRVUFMSUZZXSBJbml0aWFsaXNhdGlvbiBkdSBjbGllbnQgT3BlbkFJLi4uJylcbiAgICBjbGllbnQgPSBuZXcgT3BlbkFJKHtcbiAgICAgIGFwaUtleTogYXBpS2V5XG4gICAgfSlcbiAgICBjb25zb2xlLmxvZygnW1FVQUxJRlldIENsaWVudCBPcGVuQUkgaW5pdGlhbGlzXHUwMEU5IGF2ZWMgc3VjY1x1MDBFOHMnKVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tRVUFMSUZZXSBFUlJFVVIgbG9ycyBkZSBsXFwnaW5pdGlhbGlzYXRpb24gZHUgY2xpZW50IE9wZW5BSTonLCBlcnJvcilcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEVycmV1ciBkJ2luaXRpYWxpc2F0aW9uIE9wZW5BSTogJHtlcnJvci5tZXNzYWdlfWApXG4gIH1cblxuICAvLyBQclx1MDBFOXBhcmVyIGxlIHByb21wdFxuICBjb25zdCBwcm9tcHQgPSBgXG5UdSBlcyB1biBleHBlcnQgaW1tb2JpbGllci5cbkFuYWx5c2UgY2UgcHJvc3BlY3QgZXQgcmV0b3VybmUgU1RSSUNURU1FTlQgY2UgSlNPTiA6XG5cbntcbiAgXCJzY29yZVwiOiBudW1iZXIgKDAtMTAwKSxcbiAgXCJuaXZlYXVcIjogXCJjaGF1ZFwiIHwgXCJ0aVx1MDBFOGRlXCIgfCBcImZyb2lkXCIsXG4gIFwicmFpc29uXCI6IFwiY291cnRlIGFuYWx5c2VcIixcbiAgXCJhY3Rpb25cIjogXCJhY3Rpb24gcmVjb21tYW5kXHUwMEU5ZVwiXG59XG5cbkRvbm5cdTAwRTllcyA6XG4ke0pTT04uc3RyaW5naWZ5KGxlYWQsIG51bGwsIDIpfVxuYFxuXG4gIHRyeSB7XG4gICAgY29uc29sZS5sb2coJ1tRVUFMSUZZXSBBcHBlbCBcdTAwRTAgbFxcJ0FQSSBPcGVuQUkuLi4nKVxuICAgIGNvbnNvbGUubG9nKCdbUVVBTElGWV0gRG9ublx1MDBFOWVzIGVudm95XHUwMEU5ZXM6JywgSlNPTi5zdHJpbmdpZnkobGVhZCwgbnVsbCwgMikpXG5cbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjbGllbnQuY2hhdC5jb21wbGV0aW9ucy5jcmVhdGUoe1xuICAgICAgbW9kZWw6IFwiZ3B0LTRvLW1pbmlcIixcbiAgICBtZXNzYWdlczogW3sgcm9sZTogXCJ1c2VyXCIsIGNvbnRlbnQ6IHByb21wdCB9XSxcbiAgICAgIHRlbXBlcmF0dXJlOiAwLjIsXG4gICAgICByZXNwb25zZV9mb3JtYXQ6IHsgdHlwZTogXCJqc29uX29iamVjdFwiIH1cbiAgICB9KVxuXG4gICAgY29uc29sZS5sb2coJ1tRVUFMSUZZXSBSXHUwMEU5cG9uc2UgT3BlbkFJIHJlXHUwMEU3dWU6Jywge1xuICAgICAgaGFzQ29udGVudDogISFyZXNwb25zZT8uY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5jb250ZW50LFxuICAgICAgY29udGVudExlbmd0aDogcmVzcG9uc2U/LmNob2ljZXM/LlswXT8ubWVzc2FnZT8uY29udGVudD8ubGVuZ3RoIHx8IDBcbiAgICB9KVxuXG4gICAgLy8gVlx1MDBFOXJpZmllciBxdWUgbGEgclx1MDBFOXBvbnNlIGNvbnRpZW50IGR1IGNvbnRlbnVcbiAgICBpZiAoIXJlc3BvbnNlPy5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUlx1MDBFOXBvbnNlIE9wZW5BSSB2aWRlIC0gYXVjdW5lIHJcdTAwRTlwb25zZSBnXHUwMEU5blx1MDBFOXJcdTAwRTllJylcbiAgICB9XG5cbiAgICBjb25zdCByYXdDb250ZW50ID0gcmVzcG9uc2UuY2hvaWNlc1swXS5tZXNzYWdlLmNvbnRlbnRcbiAgICBjb25zb2xlLmxvZygnW1FVQUxJRlldIENvbnRlbnUgYnJ1dCBkZSBsYSByXHUwMEU5cG9uc2U6JywgcmF3Q29udGVudC5zdWJzdHJpbmcoMCwgMjAwKSArICcuLi4nKVxuXG4gICAgLy8gUGFyc2VyIGxlIEpTT04gZGUgbWFuaVx1MDBFOHJlIHNcdTAwRTljdXJpc1x1MDBFOWVcbiAgICBsZXQgcXVhbGlmaWNhdGlvblxuICAgIHRyeSB7XG4gICAgICBxdWFsaWZpY2F0aW9uID0gSlNPTi5wYXJzZShyYXdDb250ZW50KVxuICAgICAgY29uc29sZS5sb2coJ1tRVUFMSUZZXSBKU09OIHBhcnNcdTAwRTkgYXZlYyBzdWNjXHUwMEU4czonLCBxdWFsaWZpY2F0aW9uKVxuICAgIH0gY2F0Y2ggKHBhcnNlRXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tRVUFMSUZZXSBFUlJFVVIgbG9ycyBkdSBwYXJzaW5nIEpTT046JywgcGFyc2VFcnJvcilcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tRVUFMSUZZXSBDb250ZW51IHF1aSBhIFx1MDBFOWNob3VcdTAwRTk6JywgcmF3Q29udGVudClcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUlx1MDBFOXBvbnNlIE9wZW5BSSBpbnZhbGlkZSAoSlNPTiBub24gdmFsaWRlKTogJHtwYXJzZUVycm9yLm1lc3NhZ2V9YClcbiAgICB9XG5cbiAgICAvLyBWYWxpZGVyIGxlcyBjaGFtcHMgcmVxdWlzXG4gICAgaWYgKHR5cGVvZiBxdWFsaWZpY2F0aW9uLnNjb3JlICE9PSAnbnVtYmVyJyAmJiB0eXBlb2YgcXVhbGlmaWNhdGlvbi5zY29yZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTGUgY2hhbXAgXCJzY29yZVwiIGVzdCBtYW5xdWFudCBvdSBpbnZhbGlkZSBkYW5zIGxhIHJcdTAwRTlwb25zZSBPcGVuQUknKVxuICAgIH1cblxuICAgIGlmICghcXVhbGlmaWNhdGlvbi5uaXZlYXUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignTGUgY2hhbXAgXCJuaXZlYXVcIiBlc3QgbWFucXVhbnQgZGFucyBsYSByXHUwMEU5cG9uc2UgT3BlbkFJJylcbiAgICB9XG5cbiAgICAvLyBOb3JtYWxpc2VyIGxhIHJcdTAwRTlwb25zZVxuICAgIGNvbnN0IG5vcm1hbGl6ZWRTY29yZSA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEwMCwgcGFyc2VJbnQocXVhbGlmaWNhdGlvbi5zY29yZSkgfHwgMCkpXG4gICAgY29uc3Qgbm9ybWFsaXplZE5pdmVhdSA9IFsnY2hhdWQnLCAndGlcdTAwRThkZScsICdmcm9pZCddLmluY2x1ZGVzKHF1YWxpZmljYXRpb24ubml2ZWF1Py50b0xvd2VyQ2FzZSgpKSBcbiAgICAgID8gcXVhbGlmaWNhdGlvbi5uaXZlYXUudG9Mb3dlckNhc2UoKSBcbiAgICAgIDogbnVsbFxuXG4gICAgaWYgKCFub3JtYWxpemVkTml2ZWF1KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYE5pdmVhdSBpbnZhbGlkZTogJHtxdWFsaWZpY2F0aW9uLm5pdmVhdX0uIEF0dGVuZHU6IGNoYXVkLCB0aVx1MDBFOGRlIG91IGZyb2lkYClcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICBzY29yZTogbm9ybWFsaXplZFNjb3JlLFxuICAgICAgbml2ZWF1OiBub3JtYWxpemVkTml2ZWF1LFxuICAgICAgcmFpc29uOiBxdWFsaWZpY2F0aW9uLnJhaXNvbiB8fCAnQW5hbHlzZSBlZmZlY3R1XHUwMEU5ZScsXG4gICAgICBhY3Rpb246IHF1YWxpZmljYXRpb24uYWN0aW9uIHx8ICdDb250YWN0ZXIgbGUgcHJvc3BlY3QnXG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ1tRVUFMSUZZXSBRdWFsaWZpY2F0aW9uIHJcdTAwRTl1c3NpZTonLCByZXN1bHQpXG4gICAgcmV0dXJuIHJlc3VsdFxuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignW1FVQUxJRlldIEVSUkVVUiBsb3JzIGRlIGxcXCdhcHBlbCBPcGVuQUk6JywgZXJyb3IpXG4gICAgY29uc29sZS5lcnJvcignW1FVQUxJRlldIFN0YWNrIHRyYWNlOicsIGVycm9yLnN0YWNrKVxuICAgIFxuICAgIC8vIE5FIFBBUyByZXRvdXJuZXIgZGUgZmFsbGJhY2sgLSBsYWlzc2VyIGwnZXJyZXVyIHJlbW9udGVyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBFcnJldXIgZGUgcXVhbGlmaWNhdGlvbiBJQTogJHtlcnJvci5tZXNzYWdlIHx8ICdFcnJldXIgaW5jb25udWUnfWApXG4gIH1cbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL2Vjc3RhdGljLWJ1c3ktZGlqa3N0cmEvbW50L25leGFwL3NyYy9zZXJ2ZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9zZXNzaW9ucy9lY3N0YXRpYy1idXN5LWRpamtzdHJhL21udC9uZXhhcC9zcmMvc2VydmVyL2luZGV4LmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9zZXNzaW9ucy9lY3N0YXRpYy1idXN5LWRpamtzdHJhL21udC9uZXhhcC9zcmMvc2VydmVyL2luZGV4LmpzXCI7aW1wb3J0IHsgcXVhbGlmeUxlYWRTZXJ2ZXIgfSBmcm9tICcuL3F1YWxpZnknXG5cbi8qKlxuICogSGFuZGxlciBwb3VyIGxhIHJvdXRlIC9hcGkvcXVhbGlmeVxuICogR2FyYW50aXQgVE9VSk9VUlMgdW5lIHJcdTAwRTlwb25zZSBKU09OIHZhbGlkZSwgbVx1MDBFQW1lIGVuIGNhcyBkJ2VycmV1clxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlUXVhbGlmeShyZXEpIHtcbiAgdHJ5IHtcbiAgICAvLyBWXHUwMEU5cmlmaWVyIHF1ZSBsYSByZXF1XHUwMEVBdGUgZXN0IGJpZW4gdW5lIHJlcXVcdTAwRUF0ZSBQT1NUXG4gICAgaWYgKHJlcS5tZXRob2QgIT09ICdQT1NUJykge1xuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgICAgIG1lc3NhZ2U6ICdNXHUwMEU5dGhvZGUgbm9uIGF1dG9yaXNcdTAwRTllLiBVdGlsaXNleiBQT1NULidcbiAgICAgICAgfSksXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXM6IDQwNSxcbiAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfVxuICAgICAgICB9XG4gICAgICApXG4gICAgfVxuXG4gICAgLy8gUGFyc2VyIGxlIGJvZHkgZGUgbWFuaVx1MDBFOHJlIHNcdTAwRTljdXJpc1x1MDBFOWVcbiAgICBsZXQgYm9keVxuICAgIHRyeSB7XG4gICAgICBib2R5ID0gYXdhaXQgcmVxLmpzb24oKVxuICAgIH0gY2F0Y2ggKHBhcnNlRXJyb3IpIHtcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBlcnJvcjogdHJ1ZSxcbiAgICAgICAgICBtZXNzYWdlOiAnQ29ycHMgZGUgbGEgcmVxdVx1MDBFQXRlIGludmFsaWRlIChKU09OIGF0dGVuZHUpJ1xuICAgICAgICB9KSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICAgIH1cbiAgICAgIClcbiAgICB9XG5cbiAgICAvLyBWYWxpZGVyIGxlcyBkb25uXHUwMEU5ZXMgbWluaW1hbGVzIHJlcXVpc2VzXG4gICAgaWYgKCFib2R5IHx8IHR5cGVvZiBib2R5ICE9PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgICAgIG1lc3NhZ2U6ICdEb25uXHUwMEU5ZXMgaW52YWxpZGVzJ1xuICAgICAgICB9KSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICAgIH1cbiAgICAgIClcbiAgICB9XG5cbiAgICAvLyBBcHBlbGVyIGxhIGZvbmN0aW9uIGRlIHF1YWxpZmljYXRpb25cbiAgICAvLyBDZXR0ZSBmb25jdGlvbiBwZXV0IG1haW50ZW5hbnQgbGFuY2VyIHVuZSBlcnJldXIgc2kgT3BlbkFJIG4nZXN0IHBhcyBjb25maWd1clx1MDBFOVxuICAgIGNvbnNvbGUubG9nKCdbQVBJXSBBcHBlbCBkZSBxdWFsaWZ5TGVhZFNlcnZlciBhdmVjOicsIHtcbiAgICAgIG5vbTogYm9keS5ub20sXG4gICAgICBlbWFpbDogYm9keS5lbWFpbCxcbiAgICAgIGJ1ZGdldDogYm9keS5idWRnZXRcbiAgICB9KVxuXG4gICAgbGV0IHJlc3VsdFxuICAgIHRyeSB7XG4gICAgICByZXN1bHQgPSBhd2FpdCBxdWFsaWZ5TGVhZFNlcnZlcihib2R5KVxuICAgICAgY29uc29sZS5sb2coJ1tBUEldIFF1YWxpZmljYXRpb24gclx1MDBFOXVzc2llOicsIHJlc3VsdClcbiAgICB9IGNhdGNoIChxdWFsaWZ5RXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBUEldIEVycmV1ciBsb3JzIGRlIGxhIHF1YWxpZmljYXRpb246JywgcXVhbGlmeUVycm9yKVxuICAgICAgLy8gUmV0b3VybmVyIGwnZXJyZXVyIGRlIG1hbmlcdTAwRThyZSBleHBsaWNpdGUgYXUgZnJvbnRlbmRcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBlcnJvcjogdHJ1ZSxcbiAgICAgICAgICBtZXNzYWdlOiBxdWFsaWZ5RXJyb3IubWVzc2FnZSB8fCAnRXJyZXVyIGxvcnMgZGUgbGEgcXVhbGlmaWNhdGlvbicsXG4gICAgICAgICAgZGV0YWlsczogcXVhbGlmeUVycm9yLnN0YWNrXG4gICAgICAgIH0pLFxuICAgICAgICB7XG4gICAgICAgICAgc3RhdHVzOiA1MDAsXG4gICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH1cbiAgICAgICAgfVxuICAgICAgKVxuICAgIH1cblxuICAgIC8vIFJldG91cm5lciBsZSByXHUwMEU5c3VsdGF0IGF2ZWMgdW4gc3RhdHV0IDIwMFxuICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXG4gICAgICBKU09OLnN0cmluZ2lmeShyZXN1bHQpLFxuICAgICAge1xuICAgICAgICBzdGF0dXM6IDIwMCxcbiAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH1cbiAgICAgIH1cbiAgICApXG5cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyBDYXRjaCBmaW5hbCBwb3VyIHRvdXRlIGVycmV1ciBub24gZ1x1MDBFOXJcdTAwRTllXG4gICAgY29uc29sZS5lcnJvcignW0FQSV0gRXJyZXVyIGNyaXRpcXVlIGRhbnMgaGFuZGxlUXVhbGlmeTonLCBlcnJvcilcbiAgICBjb25zb2xlLmVycm9yKCdbQVBJXSBTdGFjayB0cmFjZTonLCBlcnJvci5zdGFjaylcbiAgICBcbiAgICAvLyBSZXRvdXJuZXIgbCdlcnJldXIgZGUgbWFuaVx1MDBFOHJlIGV4cGxpY2l0ZSAoc2FucyBmYWxsYmFjayBzaWxlbmNpZXV4KVxuICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXG4gICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiBgRXJyZXVyIHRlY2huaXF1ZTogJHtlcnJvci5tZXNzYWdlIHx8ICdFcnJldXIgaW5jb25udWUnfWAsXG4gICAgICAgIGRldGFpbHM6IGVycm9yLnN0YWNrXG4gICAgICB9KSxcbiAgICAgIHtcbiAgICAgICAgc3RhdHVzOiA1MDAsXG4gICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICB9XG4gICAgKVxuICB9XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9zZXNzaW9ucy9lY3N0YXRpYy1idXN5LWRpamtzdHJhL21udC9uZXhhcFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2Vjc3RhdGljLWJ1c3ktZGlqa3N0cmEvbW50L25leGFwL3ZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9zZXNzaW9ucy9lY3N0YXRpYy1idXN5LWRpamtzdHJhL21udC9uZXhhcC92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIC8vIENoYXJnZXIgbGVzIHZhcmlhYmxlcyBkJ2Vudmlyb25uZW1lbnRcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJylcbiAgY29uc3QgaXNEZXYgPSBtb2RlID09PSAnZGV2ZWxvcG1lbnQnXG5cbiAgcmV0dXJuIHtcbiAgICBwbHVnaW5zOiBbXG4gICAgICByZWFjdCgpLFxuICAgICAgLy8gTWlkZGxld2FyZSBsb2NhbCAvYXBpL3F1YWxpZnkgXHUyMDE0IHVuaXF1ZW1lbnQgZW4gZFx1MDBFOXZlbG9wcGVtZW50ICh2aXRlIGRldilcbiAgICAgIC8vIEVuIHByb2R1Y3Rpb24gVmVyY2VsLCBjJ2VzdCBwYWdlcy9hcGkvcXVhbGlmeS5qcyBxdWkgcHJlbmQgbGUgcmVsYWlcbiAgICAgIGlzRGV2ICYmIHtcbiAgICAgICAgbmFtZTogJ2FwaS1xdWFsaWZ5JyxcbiAgICAgICAgYXN5bmMgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICAgIC8vIEltcG9ydCBkeW5hbWlxdWUgcG91ciBcdTAwRTl2aXRlciB0b3V0IGNyYXNoIGxvcnMgZHUgYnVpbGQgVmVyY2VsXG4gICAgICAgICAgbGV0IGhhbmRsZVF1YWxpZnlcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbW9kID0gYXdhaXQgaW1wb3J0KCcuL3NyYy9zZXJ2ZXIvaW5kZXguanMnKVxuICAgICAgICAgICAgaGFuZGxlUXVhbGlmeSA9IG1vZC5oYW5kbGVRdWFsaWZ5XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbVklURV0gSW1wb3NzaWJsZSBkZSBjaGFyZ2VyIGxlIHNlcnZldXIgcXVhbGlmeTonLCBlLm1lc3NhZ2UpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoZW52LlZJVEVfT1BFTkFJX0FQSV9LRVkgJiYgIXByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZKSB7XG4gICAgICAgICAgICBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWSA9IGVudi5WSVRFX09QRU5BSV9BUElfS0VZXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChlbnYuT1BFTkFJX0FQSV9LRVkpIHtcbiAgICAgICAgICAgIHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZID0gZW52Lk9QRU5BSV9BUElfS0VZXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgnL2FwaS9xdWFsaWZ5JywgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gJ1BPU1QnKSB7XG4gICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDA1XG4gICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJylcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiB0cnVlLCBtZXNzYWdlOiAnTVx1MDBFOXRob2RlIG5vbiBhdXRvcmlzXHUwMEU5ZS4gVXRpbGlzZXogUE9TVC4nIH0pKVxuICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGxldCBib2R5ID0gJydcbiAgICAgICAgICAgICAgcmVxLm9uKCdkYXRhJywgY2h1bmsgPT4geyBib2R5ICs9IGNodW5rLnRvU3RyaW5nKCkgfSlcbiAgICAgICAgICAgICAgcmVxLm9uKCdlbmQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZEJvZHkgPSBib2R5ID8gSlNPTi5wYXJzZShib2R5KSA6IHt9XG4gICAgICAgICAgICAgICAgICBjb25zdCByZXF1ZXN0TGlrZSA9IHsgbWV0aG9kOiByZXEubWV0aG9kLCBqc29uOiBhc3luYyAoKSA9PiBwYXJzZWRCb2R5LCBoZWFkZXJzOiByZXEuaGVhZGVycyB9XG4gICAgICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGhhbmRsZVF1YWxpZnkocmVxdWVzdExpa2UpXG4gICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IHJlc3BvbnNlLnN0YXR1c1xuICAgICAgICAgICAgICAgICAgcmVzcG9uc2UuaGVhZGVycy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7IHJlcy5zZXRIZWFkZXIoa2V5LCB2YWx1ZSkgfSlcbiAgICAgICAgICAgICAgICAgIHJlcy5lbmQoYXdhaXQgcmVzcG9uc2UudGV4dCgpKVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMFxuICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKVxuICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiB0cnVlLCBtZXNzYWdlOiBlcnJvci5tZXNzYWdlIH0pKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwXG4gICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJylcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiB0cnVlLCBtZXNzYWdlOiBlcnJvci5tZXNzYWdlIH0pKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICBdLmZpbHRlcihCb29sZWFuKSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBvcGVuOiB0cnVlXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgYXNzZXRzRGlyOiAnYXNzZXRzJyxcbiAgICBzb3VyY2VtYXA6IGZhbHNlXG4gICAgfVxuICB9XG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFBeVUsT0FBTyxZQUFZO0FBTzVWLGVBQXNCLGtCQUFrQixNQUFNO0FBRTVDLFVBQVEsSUFBSSw2Q0FBMEM7QUFBQSxJQUNwRCxLQUFLLEtBQUs7QUFBQSxJQUNWLE9BQU8sS0FBSztBQUFBLElBQ1osUUFBUSxLQUFLO0FBQUEsSUFDYixVQUFVLEtBQUs7QUFBQSxFQUNqQixDQUFDO0FBS0QsUUFBTSxTQUFTLFFBQVEsSUFBSTtBQUUzQixVQUFRLElBQUksK0NBQXlDO0FBQUEsSUFDbkQsY0FBYyxDQUFDLENBQUM7QUFBQSxJQUNoQixjQUFjLFNBQVMsT0FBTyxTQUFTO0FBQUEsSUFDdkMsY0FBYyxTQUFTLE9BQU8sVUFBVSxHQUFHLENBQUMsSUFBSSxRQUFRO0FBQUEsRUFDMUQsQ0FBQztBQUVELE1BQUksQ0FBQyxVQUFVLFdBQVcsOEJBQThCO0FBQ3RELFVBQU0sV0FBVztBQUNq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

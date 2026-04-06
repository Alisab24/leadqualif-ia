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
import OpenAI from "file:///C:/Users/hp/Hp/nexap/node_modules/openai/index.mjs";
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
import { defineConfig, loadEnv } from "file:///C:/Users/hp/Hp/nexap/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/hp/Hp/nexap/node_modules/@vitejs/plugin-react/dist/index.js";
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL3NlcnZlci9xdWFsaWZ5LmpzIiwgInNyYy9zZXJ2ZXIvaW5kZXguanMiLCAidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxocFxcXFxIcFxcXFxuZXhhcFxcXFxzcmNcXFxcc2VydmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxocFxcXFxIcFxcXFxuZXhhcFxcXFxzcmNcXFxcc2VydmVyXFxcXHF1YWxpZnkuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2hwL0hwL25leGFwL3NyYy9zZXJ2ZXIvcXVhbGlmeS5qc1wiO2ltcG9ydCBPcGVuQUkgZnJvbSBcIm9wZW5haVwiXG5cbi8qKlxuICogUXVhbGlmaWNhdGlvbiBkJ3VuIGxlYWQgdmlhIE9wZW5BSVxuICogTkUgUkVUT1VSTkUgSkFNQUlTIGRlIGZhbGxiYWNrIHNpbGVuY2lldXhcbiAqIExhbmNlIHVuZSBlcnJldXIgc2kgT3BlbkFJIG4nZXN0IHBhcyBjb25maWd1clx1MDBFOSBvdSBlbiBjYXMgZCdcdTAwRTljaGVjXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBxdWFsaWZ5TGVhZFNlcnZlcihsZWFkKSB7XG4gIC8vIExvZyBkZXMgZG9ublx1MDBFOWVzIHJlXHUwMEU3dWVzXG4gIGNvbnNvbGUubG9nKCdbUVVBTElGWV0gRFx1MDBFOWJ1dCBkZSBxdWFsaWZpY2F0aW9uIHBvdXI6Jywge1xuICAgIG5vbTogbGVhZC5ub20sXG4gICAgZW1haWw6IGxlYWQuZW1haWwsXG4gICAgYnVkZ2V0OiBsZWFkLmJ1ZGdldCxcbiAgICB0eXBlQmllbjogbGVhZC50eXBlQmllblxuICB9KVxuXG4gIC8vIFZcdTAwRTlyaWZpZXIgbGEgcHJcdTAwRTlzZW5jZSBkZSBsYSBjbFx1MDBFOSBBUElcbiAgLy8gXHUyNzA1IFNcdTAwQzlDVVJJVFx1MDBDOSA6IHVuaXF1ZW1lbnQgT1BFTkFJX0FQSV9LRVkgKHNhbnMgcHJcdTAwRTlmaXhlIFZJVEVfKVxuICAvLyBWSVRFX09QRU5BSV9BUElfS0VZIGludFx1MDBFOWdyYWl0IGxhIGNsXHUwMEU5IGRhbnMgbGUgSlMgcHVibGljIFx1MjAxNCBzdXBwcmltXHUwMEU5XG4gIGNvbnN0IGFwaUtleSA9IHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZXG5cbiAgY29uc29sZS5sb2coJ1tRVUFMSUZZXSBWXHUwMEU5cmlmaWNhdGlvbiBkZSBsYSBjbFx1MDBFOSBBUEk6Jywge1xuICAgIGhhc09wZW5BSUtleTogISFhcGlLZXksXG4gICAgYXBpS2V5TGVuZ3RoOiBhcGlLZXkgPyBhcGlLZXkubGVuZ3RoIDogMCxcbiAgICBhcGlLZXlQcmVmaXg6IGFwaUtleSA/IGFwaUtleS5zdWJzdHJpbmcoMCwgNykgKyAnLi4uJyA6ICdOL0EnXG4gIH0pXG5cbiAgaWYgKCFhcGlLZXkgfHwgYXBpS2V5ID09PSAnUkVNUExBQ0VSX1BBUl9OT1VWRUxMRV9DTEUnKSB7XG4gICAgY29uc3QgZXJyb3JNc2cgPSAnT1BFTkFJX0FQSV9LRVkgbm9uIGNvbmZpZ3VyXHUwMEU5ZS4gQWpvdXRlei1sYSBkYW5zIC5lbnYgKGxvY2FsKSBldCBWZXJjZWwgRGFzaGJvYXJkID4gRW52aXJvbm1lbnQgVmFyaWFibGVzIChwcm9kdWN0aW9uKSdcbiAgICBjb25zb2xlLmVycm9yKCdbUVVBTElGWV0gRVJSRVVSOicsIGVycm9yTXNnKVxuICAgIHRocm93IG5ldyBFcnJvcihlcnJvck1zZylcbiAgfVxuXG4gIC8vIEluaXRpYWxpc2VyIGxlIGNsaWVudCBPcGVuQUlcbiAgbGV0IGNsaWVudFxuICB0cnkge1xuICAgIGNvbnNvbGUubG9nKCdbUVVBTElGWV0gSW5pdGlhbGlzYXRpb24gZHUgY2xpZW50IE9wZW5BSS4uLicpXG4gICAgY2xpZW50ID0gbmV3IE9wZW5BSSh7XG4gICAgICBhcGlLZXk6IGFwaUtleVxuICAgIH0pXG4gICAgY29uc29sZS5sb2coJ1tRVUFMSUZZXSBDbGllbnQgT3BlbkFJIGluaXRpYWxpc1x1MDBFOSBhdmVjIHN1Y2NcdTAwRThzJylcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbUVVBTElGWV0gRVJSRVVSIGxvcnMgZGUgbFxcJ2luaXRpYWxpc2F0aW9uIGR1IGNsaWVudCBPcGVuQUk6JywgZXJyb3IpXG4gICAgdGhyb3cgbmV3IEVycm9yKGBFcnJldXIgZCdpbml0aWFsaXNhdGlvbiBPcGVuQUk6ICR7ZXJyb3IubWVzc2FnZX1gKVxuICB9XG5cbiAgLy8gUHJcdTAwRTlwYXJlciBsZSBwcm9tcHRcbiAgY29uc3QgcHJvbXB0ID0gYFxuVHUgZXMgdW4gZXhwZXJ0IGltbW9iaWxpZXIuXG5BbmFseXNlIGNlIHByb3NwZWN0IGV0IHJldG91cm5lIFNUUklDVEVNRU5UIGNlIEpTT04gOlxuXG57XG4gIFwic2NvcmVcIjogbnVtYmVyICgwLTEwMCksXG4gIFwibml2ZWF1XCI6IFwiY2hhdWRcIiB8IFwidGlcdTAwRThkZVwiIHwgXCJmcm9pZFwiLFxuICBcInJhaXNvblwiOiBcImNvdXJ0ZSBhbmFseXNlXCIsXG4gIFwiYWN0aW9uXCI6IFwiYWN0aW9uIHJlY29tbWFuZFx1MDBFOWVcIlxufVxuXG5Eb25uXHUwMEU5ZXMgOlxuJHtKU09OLnN0cmluZ2lmeShsZWFkLCBudWxsLCAyKX1cbmBcblxuICB0cnkge1xuICAgIGNvbnNvbGUubG9nKCdbUVVBTElGWV0gQXBwZWwgXHUwMEUwIGxcXCdBUEkgT3BlbkFJLi4uJylcbiAgICBjb25zb2xlLmxvZygnW1FVQUxJRlldIERvbm5cdTAwRTllcyBlbnZveVx1MDBFOWVzOicsIEpTT04uc3RyaW5naWZ5KGxlYWQsIG51bGwsIDIpKVxuXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2xpZW50LmNoYXQuY29tcGxldGlvbnMuY3JlYXRlKHtcbiAgICAgIG1vZGVsOiBcImdwdC00by1taW5pXCIsXG4gICAgbWVzc2FnZXM6IFt7IHJvbGU6IFwidXNlclwiLCBjb250ZW50OiBwcm9tcHQgfV0sXG4gICAgICB0ZW1wZXJhdHVyZTogMC4yLFxuICAgICAgcmVzcG9uc2VfZm9ybWF0OiB7IHR5cGU6IFwianNvbl9vYmplY3RcIiB9XG4gICAgfSlcblxuICAgIGNvbnNvbGUubG9nKCdbUVVBTElGWV0gUlx1MDBFOXBvbnNlIE9wZW5BSSByZVx1MDBFN3VlOicsIHtcbiAgICAgIGhhc0NvbnRlbnQ6ICEhcmVzcG9uc2U/LmNob2ljZXM/LlswXT8ubWVzc2FnZT8uY29udGVudCxcbiAgICAgIGNvbnRlbnRMZW5ndGg6IHJlc3BvbnNlPy5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmNvbnRlbnQ/Lmxlbmd0aCB8fCAwXG4gICAgfSlcblxuICAgIC8vIFZcdTAwRTlyaWZpZXIgcXVlIGxhIHJcdTAwRTlwb25zZSBjb250aWVudCBkdSBjb250ZW51XG4gICAgaWYgKCFyZXNwb25zZT8uY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5jb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JcdTAwRTlwb25zZSBPcGVuQUkgdmlkZSAtIGF1Y3VuZSByXHUwMEU5cG9uc2UgZ1x1MDBFOW5cdTAwRTlyXHUwMEU5ZScpXG4gICAgfVxuXG4gICAgY29uc3QgcmF3Q29udGVudCA9IHJlc3BvbnNlLmNob2ljZXNbMF0ubWVzc2FnZS5jb250ZW50XG4gICAgY29uc29sZS5sb2coJ1tRVUFMSUZZXSBDb250ZW51IGJydXQgZGUgbGEgclx1MDBFOXBvbnNlOicsIHJhd0NvbnRlbnQuc3Vic3RyaW5nKDAsIDIwMCkgKyAnLi4uJylcblxuICAgIC8vIFBhcnNlciBsZSBKU09OIGRlIG1hbmlcdTAwRThyZSBzXHUwMEU5Y3VyaXNcdTAwRTllXG4gICAgbGV0IHF1YWxpZmljYXRpb25cbiAgICB0cnkge1xuICAgICAgcXVhbGlmaWNhdGlvbiA9IEpTT04ucGFyc2UocmF3Q29udGVudClcbiAgICAgIGNvbnNvbGUubG9nKCdbUVVBTElGWV0gSlNPTiBwYXJzXHUwMEU5IGF2ZWMgc3VjY1x1MDBFOHM6JywgcXVhbGlmaWNhdGlvbilcbiAgICB9IGNhdGNoIChwYXJzZUVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbUVVBTElGWV0gRVJSRVVSIGxvcnMgZHUgcGFyc2luZyBKU09OOicsIHBhcnNlRXJyb3IpXG4gICAgICBjb25zb2xlLmVycm9yKCdbUVVBTElGWV0gQ29udGVudSBxdWkgYSBcdTAwRTljaG91XHUwMEU5OicsIHJhd0NvbnRlbnQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFJcdTAwRTlwb25zZSBPcGVuQUkgaW52YWxpZGUgKEpTT04gbm9uIHZhbGlkZSk6ICR7cGFyc2VFcnJvci5tZXNzYWdlfWApXG4gICAgfVxuXG4gICAgLy8gVmFsaWRlciBsZXMgY2hhbXBzIHJlcXVpc1xuICAgIGlmICh0eXBlb2YgcXVhbGlmaWNhdGlvbi5zY29yZSAhPT0gJ251bWJlcicgJiYgdHlwZW9mIHF1YWxpZmljYXRpb24uc2NvcmUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0xlIGNoYW1wIFwic2NvcmVcIiBlc3QgbWFucXVhbnQgb3UgaW52YWxpZGUgZGFucyBsYSByXHUwMEU5cG9uc2UgT3BlbkFJJylcbiAgICB9XG5cbiAgICBpZiAoIXF1YWxpZmljYXRpb24ubml2ZWF1KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0xlIGNoYW1wIFwibml2ZWF1XCIgZXN0IG1hbnF1YW50IGRhbnMgbGEgclx1MDBFOXBvbnNlIE9wZW5BSScpXG4gICAgfVxuXG4gICAgLy8gTm9ybWFsaXNlciBsYSByXHUwMEU5cG9uc2VcbiAgICBjb25zdCBub3JtYWxpemVkU2NvcmUgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxMDAsIHBhcnNlSW50KHF1YWxpZmljYXRpb24uc2NvcmUpIHx8IDApKVxuICAgIGNvbnN0IG5vcm1hbGl6ZWROaXZlYXUgPSBbJ2NoYXVkJywgJ3RpXHUwMEU4ZGUnLCAnZnJvaWQnXS5pbmNsdWRlcyhxdWFsaWZpY2F0aW9uLm5pdmVhdT8udG9Mb3dlckNhc2UoKSkgXG4gICAgICA/IHF1YWxpZmljYXRpb24ubml2ZWF1LnRvTG93ZXJDYXNlKCkgXG4gICAgICA6IG51bGxcblxuICAgIGlmICghbm9ybWFsaXplZE5pdmVhdSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBOaXZlYXUgaW52YWxpZGU6ICR7cXVhbGlmaWNhdGlvbi5uaXZlYXV9LiBBdHRlbmR1OiBjaGF1ZCwgdGlcdTAwRThkZSBvdSBmcm9pZGApXG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgc2NvcmU6IG5vcm1hbGl6ZWRTY29yZSxcbiAgICAgIG5pdmVhdTogbm9ybWFsaXplZE5pdmVhdSxcbiAgICAgIHJhaXNvbjogcXVhbGlmaWNhdGlvbi5yYWlzb24gfHwgJ0FuYWx5c2UgZWZmZWN0dVx1MDBFOWUnLFxuICAgICAgYWN0aW9uOiBxdWFsaWZpY2F0aW9uLmFjdGlvbiB8fCAnQ29udGFjdGVyIGxlIHByb3NwZWN0J1xuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKCdbUVVBTElGWV0gUXVhbGlmaWNhdGlvbiByXHUwMEU5dXNzaWU6JywgcmVzdWx0KVxuICAgIHJldHVybiByZXN1bHRcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tRVUFMSUZZXSBFUlJFVVIgbG9ycyBkZSBsXFwnYXBwZWwgT3BlbkFJOicsIGVycm9yKVxuICAgIGNvbnNvbGUuZXJyb3IoJ1tRVUFMSUZZXSBTdGFjayB0cmFjZTonLCBlcnJvci5zdGFjaylcbiAgICBcbiAgICAvLyBORSBQQVMgcmV0b3VybmVyIGRlIGZhbGxiYWNrIC0gbGFpc3NlciBsJ2VycmV1ciByZW1vbnRlclxuICAgIHRocm93IG5ldyBFcnJvcihgRXJyZXVyIGRlIHF1YWxpZmljYXRpb24gSUE6ICR7ZXJyb3IubWVzc2FnZSB8fCAnRXJyZXVyIGluY29ubnVlJ31gKVxuICB9XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGhwXFxcXEhwXFxcXG5leGFwXFxcXHNyY1xcXFxzZXJ2ZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGhwXFxcXEhwXFxcXG5leGFwXFxcXHNyY1xcXFxzZXJ2ZXJcXFxcaW5kZXguanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2hwL0hwL25leGFwL3NyYy9zZXJ2ZXIvaW5kZXguanNcIjtpbXBvcnQgeyBxdWFsaWZ5TGVhZFNlcnZlciB9IGZyb20gJy4vcXVhbGlmeSdcblxuLyoqXG4gKiBIYW5kbGVyIHBvdXIgbGEgcm91dGUgL2FwaS9xdWFsaWZ5XG4gKiBHYXJhbnRpdCBUT1VKT1VSUyB1bmUgclx1MDBFOXBvbnNlIEpTT04gdmFsaWRlLCBtXHUwMEVBbWUgZW4gY2FzIGQnZXJyZXVyXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYW5kbGVRdWFsaWZ5KHJlcSkge1xuICB0cnkge1xuICAgIC8vIFZcdTAwRTlyaWZpZXIgcXVlIGxhIHJlcXVcdTAwRUF0ZSBlc3QgYmllbiB1bmUgcmVxdVx1MDBFQXRlIFBPU1RcbiAgICBpZiAocmVxLm1ldGhvZCAhPT0gJ1BPU1QnKSB7XG4gICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFxuICAgICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgZXJyb3I6IHRydWUsXG4gICAgICAgICAgbWVzc2FnZTogJ01cdTAwRTl0aG9kZSBub24gYXV0b3Jpc1x1MDBFOWUuIFV0aWxpc2V6IFBPU1QuJ1xuICAgICAgICB9KSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YXR1czogNDA1LFxuICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICAgIH1cbiAgICAgIClcbiAgICB9XG5cbiAgICAvLyBQYXJzZXIgbGUgYm9keSBkZSBtYW5pXHUwMEU4cmUgc1x1MDBFOWN1cmlzXHUwMEU5ZVxuICAgIGxldCBib2R5XG4gICAgdHJ5IHtcbiAgICAgIGJvZHkgPSBhd2FpdCByZXEuanNvbigpXG4gICAgfSBjYXRjaCAocGFyc2VFcnJvcikge1xuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgICAgIG1lc3NhZ2U6ICdDb3JwcyBkZSBsYSByZXF1XHUwMEVBdGUgaW52YWxpZGUgKEpTT04gYXR0ZW5kdSknXG4gICAgICAgIH0pLFxuICAgICAgICB7XG4gICAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH1cbiAgICAgICAgfVxuICAgICAgKVxuICAgIH1cblxuICAgIC8vIFZhbGlkZXIgbGVzIGRvbm5cdTAwRTllcyBtaW5pbWFsZXMgcmVxdWlzZXNcbiAgICBpZiAoIWJvZHkgfHwgdHlwZW9mIGJvZHkgIT09ICdvYmplY3QnKSB7XG4gICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFxuICAgICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgZXJyb3I6IHRydWUsXG4gICAgICAgICAgbWVzc2FnZTogJ0Rvbm5cdTAwRTllcyBpbnZhbGlkZXMnXG4gICAgICAgIH0pLFxuICAgICAgICB7XG4gICAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH1cbiAgICAgICAgfVxuICAgICAgKVxuICAgIH1cblxuICAgIC8vIEFwcGVsZXIgbGEgZm9uY3Rpb24gZGUgcXVhbGlmaWNhdGlvblxuICAgIC8vIENldHRlIGZvbmN0aW9uIHBldXQgbWFpbnRlbmFudCBsYW5jZXIgdW5lIGVycmV1ciBzaSBPcGVuQUkgbidlc3QgcGFzIGNvbmZpZ3VyXHUwMEU5XG4gICAgY29uc29sZS5sb2coJ1tBUEldIEFwcGVsIGRlIHF1YWxpZnlMZWFkU2VydmVyIGF2ZWM6Jywge1xuICAgICAgbm9tOiBib2R5Lm5vbSxcbiAgICAgIGVtYWlsOiBib2R5LmVtYWlsLFxuICAgICAgYnVkZ2V0OiBib2R5LmJ1ZGdldFxuICAgIH0pXG5cbiAgICBsZXQgcmVzdWx0XG4gICAgdHJ5IHtcbiAgICAgIHJlc3VsdCA9IGF3YWl0IHF1YWxpZnlMZWFkU2VydmVyKGJvZHkpXG4gICAgICBjb25zb2xlLmxvZygnW0FQSV0gUXVhbGlmaWNhdGlvbiByXHUwMEU5dXNzaWU6JywgcmVzdWx0KVxuICAgIH0gY2F0Y2ggKHF1YWxpZnlFcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW0FQSV0gRXJyZXVyIGxvcnMgZGUgbGEgcXVhbGlmaWNhdGlvbjonLCBxdWFsaWZ5RXJyb3IpXG4gICAgICAvLyBSZXRvdXJuZXIgbCdlcnJldXIgZGUgbWFuaVx1MDBFOHJlIGV4cGxpY2l0ZSBhdSBmcm9udGVuZFxuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgICAgIG1lc3NhZ2U6IHF1YWxpZnlFcnJvci5tZXNzYWdlIHx8ICdFcnJldXIgbG9ycyBkZSBsYSBxdWFsaWZpY2F0aW9uJyxcbiAgICAgICAgICBkZXRhaWxzOiBxdWFsaWZ5RXJyb3Iuc3RhY2tcbiAgICAgICAgfSksXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXM6IDUwMCxcbiAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfVxuICAgICAgICB9XG4gICAgICApXG4gICAgfVxuXG4gICAgLy8gUmV0b3VybmVyIGxlIHJcdTAwRTlzdWx0YXQgYXZlYyB1biBzdGF0dXQgMjAwXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShcbiAgICAgIEpTT04uc3RyaW5naWZ5KHJlc3VsdCksXG4gICAgICB7XG4gICAgICAgIHN0YXR1czogMjAwLFxuICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfVxuICAgICAgfVxuICAgIClcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIC8vIENhdGNoIGZpbmFsIHBvdXIgdG91dGUgZXJyZXVyIG5vbiBnXHUwMEU5clx1MDBFOWVcbiAgICBjb25zb2xlLmVycm9yKCdbQVBJXSBFcnJldXIgY3JpdGlxdWUgZGFucyBoYW5kbGVRdWFsaWZ5OicsIGVycm9yKVxuICAgIGNvbnNvbGUuZXJyb3IoJ1tBUEldIFN0YWNrIHRyYWNlOicsIGVycm9yLnN0YWNrKVxuICAgIFxuICAgIC8vIFJldG91cm5lciBsJ2VycmV1ciBkZSBtYW5pXHUwMEU4cmUgZXhwbGljaXRlIChzYW5zIGZhbGxiYWNrIHNpbGVuY2lldXgpXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShcbiAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZXJyb3I6IHRydWUsXG4gICAgICAgIG1lc3NhZ2U6IGBFcnJldXIgdGVjaG5pcXVlOiAke2Vycm9yLm1lc3NhZ2UgfHwgJ0VycmV1ciBpbmNvbm51ZSd9YCxcbiAgICAgICAgZGV0YWlsczogZXJyb3Iuc3RhY2tcbiAgICAgIH0pLFxuICAgICAge1xuICAgICAgICBzdGF0dXM6IDUwMCxcbiAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH1cbiAgICAgIH1cbiAgICApXG4gIH1cbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcaHBcXFxcSHBcXFxcbmV4YXBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGhwXFxcXEhwXFxcXG5leGFwXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9ocC9IcC9uZXhhcC92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIC8vIENoYXJnZXIgbGVzIHZhcmlhYmxlcyBkJ2Vudmlyb25uZW1lbnRcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJylcbiAgY29uc3QgaXNEZXYgPSBtb2RlID09PSAnZGV2ZWxvcG1lbnQnXG5cbiAgcmV0dXJuIHtcbiAgICBwbHVnaW5zOiBbXG4gICAgICByZWFjdCgpLFxuICAgICAgLy8gTWlkZGxld2FyZSBsb2NhbCAvYXBpL3F1YWxpZnkgXHUyMDE0IHVuaXF1ZW1lbnQgZW4gZFx1MDBFOXZlbG9wcGVtZW50ICh2aXRlIGRldilcbiAgICAgIC8vIEVuIHByb2R1Y3Rpb24gVmVyY2VsLCBjJ2VzdCBwYWdlcy9hcGkvcXVhbGlmeS5qcyBxdWkgcHJlbmQgbGUgcmVsYWlcbiAgICAgIGlzRGV2ICYmIHtcbiAgICAgICAgbmFtZTogJ2FwaS1xdWFsaWZ5JyxcbiAgICAgICAgYXN5bmMgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICAgIC8vIEltcG9ydCBkeW5hbWlxdWUgcG91ciBcdTAwRTl2aXRlciB0b3V0IGNyYXNoIGxvcnMgZHUgYnVpbGQgVmVyY2VsXG4gICAgICAgICAgbGV0IGhhbmRsZVF1YWxpZnlcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbW9kID0gYXdhaXQgaW1wb3J0KCcuL3NyYy9zZXJ2ZXIvaW5kZXguanMnKVxuICAgICAgICAgICAgaGFuZGxlUXVhbGlmeSA9IG1vZC5oYW5kbGVRdWFsaWZ5XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbVklURV0gSW1wb3NzaWJsZSBkZSBjaGFyZ2VyIGxlIHNlcnZldXIgcXVhbGlmeTonLCBlLm1lc3NhZ2UpXG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoZW52LlZJVEVfT1BFTkFJX0FQSV9LRVkgJiYgIXByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZKSB7XG4gICAgICAgICAgICBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWSA9IGVudi5WSVRFX09QRU5BSV9BUElfS0VZXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChlbnYuT1BFTkFJX0FQSV9LRVkpIHtcbiAgICAgICAgICAgIHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZID0gZW52Lk9QRU5BSV9BUElfS0VZXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgnL2FwaS9xdWFsaWZ5JywgYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gICAgICAgICAgICBpZiAocmVxLm1ldGhvZCAhPT0gJ1BPU1QnKSB7XG4gICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDA1XG4gICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJylcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiB0cnVlLCBtZXNzYWdlOiAnTVx1MDBFOXRob2RlIG5vbiBhdXRvcmlzXHUwMEU5ZS4gVXRpbGlzZXogUE9TVC4nIH0pKVxuICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGxldCBib2R5ID0gJydcbiAgICAgICAgICAgICAgcmVxLm9uKCdkYXRhJywgY2h1bmsgPT4geyBib2R5ICs9IGNodW5rLnRvU3RyaW5nKCkgfSlcbiAgICAgICAgICAgICAgcmVxLm9uKCdlbmQnLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZEJvZHkgPSBib2R5ID8gSlNPTi5wYXJzZShib2R5KSA6IHt9XG4gICAgICAgICAgICAgICAgICBjb25zdCByZXF1ZXN0TGlrZSA9IHsgbWV0aG9kOiByZXEubWV0aG9kLCBqc29uOiBhc3luYyAoKSA9PiBwYXJzZWRCb2R5LCBoZWFkZXJzOiByZXEuaGVhZGVycyB9XG4gICAgICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGhhbmRsZVF1YWxpZnkocmVxdWVzdExpa2UpXG4gICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IHJlc3BvbnNlLnN0YXR1c1xuICAgICAgICAgICAgICAgICAgcmVzcG9uc2UuaGVhZGVycy5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7IHJlcy5zZXRIZWFkZXIoa2V5LCB2YWx1ZSkgfSlcbiAgICAgICAgICAgICAgICAgIHJlcy5lbmQoYXdhaXQgcmVzcG9uc2UudGV4dCgpKVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDUwMFxuICAgICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKVxuICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiB0cnVlLCBtZXNzYWdlOiBlcnJvci5tZXNzYWdlIH0pKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNTAwXG4gICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJylcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiB0cnVlLCBtZXNzYWdlOiBlcnJvci5tZXNzYWdlIH0pKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICBdLmZpbHRlcihCb29sZWFuKSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBvcGVuOiB0cnVlXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgYXNzZXRzRGlyOiAnYXNzZXRzJyxcbiAgICBzb3VyY2VtYXA6IGZhbHNlXG4gICAgfVxuICB9XG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFBcVIsT0FBTyxZQUFZO0FBT3hTLGVBQXNCLGtCQUFrQixNQUFNO0FBRTVDLFVBQVEsSUFBSSw2Q0FBMEM7QUFBQSxJQUNwRCxLQUFLLEtBQUs7QUFBQSxJQUNWLE9BQU8sS0FBSztBQUFBLElBQ1osUUFBUSxLQUFLO0FBQUEsSUFDYixVQUFVLEtBQUs7QUFBQSxFQUNqQixDQUFDO0FBS0QsUUFBTSxTQUFTLFFBQVEsSUFBSTtBQUUzQixVQUFRLElBQUksK0NBQXlDO0FBQUEsSUFDbkQsY0FBYyxDQUFDLENBQUM7QUFBQSxJQUNoQixjQUFjLFNBQVMsT0FBTyxTQUFTO0FBQUEsSUFDdkMsY0FBYyxTQUFTLE9BQU8sVUFBVSxHQUFHLENBQUMsSUFBSSxRQUFRO0FBQUEsRUFDMUQsQ0FBQztBQUVELE1BQUksQ0FBQyxVQUFVLFdBQVcsOEJBQThCO0FBQ3RELFVBQU0sV0FBVztBQUNqQixZQUFRLE1BQU0scUJBQXFCLFFBQVE7QUFDM0MsVUFBTSxJQUFJLE1BQU0sUUFBUTtBQUFBLEVBQzFCO0FBR0EsTUFBSTtBQUNKLE1BQUk7QUFDRixZQUFR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

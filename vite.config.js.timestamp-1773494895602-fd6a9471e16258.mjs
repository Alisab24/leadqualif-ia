// vite.config.js
import { defineConfig, loadEnv } from "file:///C:/Users/hp/Hp/nexap/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/hp/Hp/nexap/node_modules/@vitejs/plugin-react/dist/index.js";

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

// src/server/index.js
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

// vite.config.js
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      {
        name: "api-qualify",
        configureServer(server) {
          if (env.VITE_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = env.VITE_OPENAI_API_KEY;
            console.log("[VITE] Variable VITE_OPENAI_API_KEY charg\xE9e dans process.env");
          }
          if (env.OPENAI_API_KEY) {
            process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
            console.log("[VITE] Variable OPENAI_API_KEY charg\xE9e depuis .env");
          }
          server.middlewares.use("/api/qualify", async (req, res, next) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                error: true,
                message: "M\xE9thode non autoris\xE9e. Utilisez POST."
              }));
              return;
            }
            try {
              let body = "";
              req.on("data", (chunk) => {
                body += chunk.toString();
              });
              req.on("end", async () => {
                try {
                  let parsedBody = {};
                  if (body) {
                    try {
                      parsedBody = JSON.parse(body);
                    } catch (parseError) {
                      res.statusCode = 400;
                      res.setHeader("Content-Type", "application/json");
                      res.end(JSON.stringify({
                        error: true,
                        message: "Corps de la requ\xEAte invalide (JSON attendu)"
                      }));
                      return;
                    }
                  }
                  const requestLike = {
                    method: req.method,
                    json: async () => parsedBody,
                    headers: req.headers
                  };
                  const response = await handleQualify(requestLike);
                  res.statusCode = response.status;
                  response.headers.forEach((value, key) => {
                    res.setHeader(key, value);
                  });
                  const text = await response.text();
                  res.end(text);
                } catch (error) {
                  console.error("[VITE MIDDLEWARE] Erreur dans le middleware API:", error);
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({
                    error: true,
                    message: `Erreur technique: ${error.message || "Erreur inconnue"}`,
                    details: error.stack
                  }));
                }
              });
            } catch (error) {
              console.error("[VITE MIDDLEWARE] Erreur critique:", error);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                error: true,
                message: `Erreur technique: ${error.message || "Erreur inconnue"}`,
                details: error.stack
              }));
            }
          });
        }
      }
    ],
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAic3JjL3NlcnZlci9xdWFsaWZ5LmpzIiwgInNyYy9zZXJ2ZXIvaW5kZXguanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxocFxcXFxIcFxcXFxuZXhhcFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcaHBcXFxcSHBcXFxcbmV4YXBcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2hwL0hwL25leGFwL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB7IGhhbmRsZVF1YWxpZnkgfSBmcm9tICcuL3NyYy9zZXJ2ZXIvaW5kZXguanMnXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIC8vIENoYXJnZXIgbGVzIHZhcmlhYmxlcyBkJ2Vudmlyb25uZW1lbnRcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJylcbiAgXG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogW1xuICAgICAgcmVhY3QoKSxcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ2FwaS1xdWFsaWZ5JyxcbiAgICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICAgIC8vIEluamVjdGVyIGxlcyB2YXJpYWJsZXMgZCdlbnZpcm9ubmVtZW50IGRhbnMgcHJvY2Vzcy5lbnYgcG91ciBsZSBtaWRkbGV3YXJlXG4gICAgICAgICAgLy8gVml0ZSBjaGFyZ2UgbGVzIHZhcmlhYmxlcyAuZW52IG1haXMgc2V1bGVtZW50IHBvdXIgVklURV8qIGNcdTAwRjR0XHUwMEU5IGNsaWVudFxuICAgICAgICAgIC8vIE9uIGRvaXQgbGVzIGV4cG9zZXIgYXVzc2kgZGFucyBwcm9jZXNzLmVudiBwb3VyIGxlIG1pZGRsZXdhcmUgc2VydmV1clxuICAgICAgICAgIGlmIChlbnYuVklURV9PUEVOQUlfQVBJX0tFWSAmJiAhcHJvY2Vzcy5lbnYuT1BFTkFJX0FQSV9LRVkpIHtcbiAgICAgICAgICAgIHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZID0gZW52LlZJVEVfT1BFTkFJX0FQSV9LRVlcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVklURV0gVmFyaWFibGUgVklURV9PUEVOQUlfQVBJX0tFWSBjaGFyZ1x1MDBFOWUgZGFucyBwcm9jZXNzLmVudicpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChlbnYuT1BFTkFJX0FQSV9LRVkpIHtcbiAgICAgICAgICAgIHByb2Nlc3MuZW52Lk9QRU5BSV9BUElfS0VZID0gZW52Lk9QRU5BSV9BUElfS0VZXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1ZJVEVdIFZhcmlhYmxlIE9QRU5BSV9BUElfS0VZIGNoYXJnXHUwMEU5ZSBkZXB1aXMgLmVudicpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgnL2FwaS9xdWFsaWZ5JywgYXN5bmMgKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgICAgLy8gTmUgdHJhaXRlciBxdWUgbGVzIHJlcXVcdTAwRUF0ZXMgUE9TVFxuICAgICAgICAgIGlmIChyZXEubWV0aG9kICE9PSAnUE9TVCcpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDA1XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpXG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgZXJyb3I6IHRydWUsXG4gICAgICAgICAgICAgIG1lc3NhZ2U6ICdNXHUwMEU5dGhvZGUgbm9uIGF1dG9yaXNcdTAwRTllLiBVdGlsaXNleiBQT1NULidcbiAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIExpcmUgbGUgYm9keSBkZSBsYSByZXF1XHUwMEVBdGVcbiAgICAgICAgICAgIGxldCBib2R5ID0gJydcbiAgICAgICAgICAgIHJlcS5vbignZGF0YScsIGNodW5rID0+IHtcbiAgICAgICAgICAgICAgYm9keSArPSBjaHVuay50b1N0cmluZygpXG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICByZXEub24oJ2VuZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBQYXJzZXIgbGUgYm9keSBKU09OXG4gICAgICAgICAgICAgICAgbGV0IHBhcnNlZEJvZHkgPSB7fVxuICAgICAgICAgICAgICAgIGlmIChib2R5KSB7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBwYXJzZWRCb2R5ID0gSlNPTi5wYXJzZShib2R5KVxuICAgICAgICAgICAgICAgICAgfSBjYXRjaCAocGFyc2VFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwMFxuICAgICAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpXG4gICAgICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdDb3JwcyBkZSBsYSByZXF1XHUwMEVBdGUgaW52YWxpZGUgKEpTT04gYXR0ZW5kdSknXG4gICAgICAgICAgICAgICAgICAgIH0pKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBDclx1MDBFOWVyIHVuIG9iamV0IFJlcXVlc3QtbGlrZSBwb3VyIG5vdHJlIGhhbmRsZXJcbiAgICAgICAgICAgICAgICBjb25zdCByZXF1ZXN0TGlrZSA9IHtcbiAgICAgICAgICAgICAgICAgIG1ldGhvZDogcmVxLm1ldGhvZCxcbiAgICAgICAgICAgICAgICAgIGpzb246IGFzeW5jICgpID0+IHBhcnNlZEJvZHksXG4gICAgICAgICAgICAgICAgICBoZWFkZXJzOiByZXEuaGVhZGVyc1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEFwcGVsZXIgbm90cmUgaGFuZGxlclxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgaGFuZGxlUXVhbGlmeShyZXF1ZXN0TGlrZSlcblxuICAgICAgICAgICAgICAgIC8vIEVudm95ZXIgbGEgclx1MDBFOXBvbnNlXG4gICAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSByZXNwb25zZS5zdGF0dXNcbiAgICAgICAgICAgICAgICByZXNwb25zZS5oZWFkZXJzLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoa2V5LCB2YWx1ZSlcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KClcbiAgICAgICAgICAgICAgICByZXMuZW5kKHRleHQpXG4gICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1ZJVEUgTUlERExFV0FSRV0gRXJyZXVyIGRhbnMgbGUgbWlkZGxld2FyZSBBUEk6JywgZXJyb3IpXG4gICAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDBcbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpXG4gICAgICAgICAgICAgICAgLy8gTkUgUEFTIHJldG91cm5lciBkZSBmYWxsYmFjayAtIGxhaXNzZXIgbCdlcnJldXIgcmVtb250ZXJcbiAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYEVycmV1ciB0ZWNobmlxdWU6ICR7ZXJyb3IubWVzc2FnZSB8fCAnRXJyZXVyIGluY29ubnVlJ31gLFxuICAgICAgICAgICAgICAgICAgZGV0YWlsczogZXJyb3Iuc3RhY2tcbiAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1ZJVEUgTUlERExFV0FSRV0gRXJyZXVyIGNyaXRpcXVlOicsIGVycm9yKVxuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA1MDBcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJylcbiAgICAgICAgICAgIC8vIE5FIFBBUyByZXRvdXJuZXIgZGUgZmFsbGJhY2sgLSBsYWlzc2VyIGwnZXJyZXVyIHJlbW9udGVyXG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgZXJyb3I6IHRydWUsXG4gICAgICAgICAgICAgIG1lc3NhZ2U6IGBFcnJldXIgdGVjaG5pcXVlOiAke2Vycm9yLm1lc3NhZ2UgfHwgJ0VycmV1ciBpbmNvbm51ZSd9YCxcbiAgICAgICAgICAgICAgZGV0YWlsczogZXJyb3Iuc3RhY2tcbiAgICAgICAgICAgIH0pKVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIF0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUxNzMsXG4gICAgb3BlbjogdHJ1ZVxuICB9LFxuICBidWlsZDoge1xuICAgIG91dERpcjogJ2Rpc3QnLFxuICAgIGFzc2V0c0RpcjogJ2Fzc2V0cycsXG4gICAgc291cmNlbWFwOiBmYWxzZVxuICAgIH1cbiAgfVxufSlcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcaHBcXFxcSHBcXFxcbmV4YXBcXFxcc3JjXFxcXHNlcnZlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcaHBcXFxcSHBcXFxcbmV4YXBcXFxcc3JjXFxcXHNlcnZlclxcXFxxdWFsaWZ5LmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9ocC9IcC9uZXhhcC9zcmMvc2VydmVyL3F1YWxpZnkuanNcIjtpbXBvcnQgT3BlbkFJIGZyb20gXCJvcGVuYWlcIlxuXG4vKipcbiAqIFF1YWxpZmljYXRpb24gZCd1biBsZWFkIHZpYSBPcGVuQUlcbiAqIE5FIFJFVE9VUk5FIEpBTUFJUyBkZSBmYWxsYmFjayBzaWxlbmNpZXV4XG4gKiBMYW5jZSB1bmUgZXJyZXVyIHNpIE9wZW5BSSBuJ2VzdCBwYXMgY29uZmlndXJcdTAwRTkgb3UgZW4gY2FzIGQnXHUwMEU5Y2hlY1xuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcXVhbGlmeUxlYWRTZXJ2ZXIobGVhZCkge1xuICAvLyBMb2cgZGVzIGRvbm5cdTAwRTllcyByZVx1MDBFN3Vlc1xuICBjb25zb2xlLmxvZygnW1FVQUxJRlldIERcdTAwRTlidXQgZGUgcXVhbGlmaWNhdGlvbiBwb3VyOicsIHtcbiAgICBub206IGxlYWQubm9tLFxuICAgIGVtYWlsOiBsZWFkLmVtYWlsLFxuICAgIGJ1ZGdldDogbGVhZC5idWRnZXQsXG4gICAgdHlwZUJpZW46IGxlYWQudHlwZUJpZW5cbiAgfSlcblxuICAvLyBWXHUwMEU5cmlmaWVyIGxhIHByXHUwMEU5c2VuY2UgZGUgbGEgY2xcdTAwRTkgQVBJXG4gIC8vIFx1MjcwNSBTXHUwMEM5Q1VSSVRcdTAwQzkgOiB1bmlxdWVtZW50IE9QRU5BSV9BUElfS0VZIChzYW5zIHByXHUwMEU5Zml4ZSBWSVRFXylcbiAgLy8gVklURV9PUEVOQUlfQVBJX0tFWSBpbnRcdTAwRTlncmFpdCBsYSBjbFx1MDBFOSBkYW5zIGxlIEpTIHB1YmxpYyBcdTIwMTQgc3VwcHJpbVx1MDBFOVxuICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWVxuXG4gIGNvbnNvbGUubG9nKCdbUVVBTElGWV0gVlx1MDBFOXJpZmljYXRpb24gZGUgbGEgY2xcdTAwRTkgQVBJOicsIHtcbiAgICBoYXNPcGVuQUlLZXk6ICEhYXBpS2V5LFxuICAgIGFwaUtleUxlbmd0aDogYXBpS2V5ID8gYXBpS2V5Lmxlbmd0aCA6IDAsXG4gICAgYXBpS2V5UHJlZml4OiBhcGlLZXkgPyBhcGlLZXkuc3Vic3RyaW5nKDAsIDcpICsgJy4uLicgOiAnTi9BJ1xuICB9KVxuXG4gIGlmICghYXBpS2V5IHx8IGFwaUtleSA9PT0gJ1JFTVBMQUNFUl9QQVJfTk9VVkVMTEVfQ0xFJykge1xuICAgIGNvbnN0IGVycm9yTXNnID0gJ09QRU5BSV9BUElfS0VZIG5vbiBjb25maWd1clx1MDBFOWUuIEFqb3V0ZXotbGEgZGFucyAuZW52IChsb2NhbCkgZXQgVmVyY2VsIERhc2hib2FyZCA+IEVudmlyb25tZW50IFZhcmlhYmxlcyAocHJvZHVjdGlvbiknXG4gICAgY29uc29sZS5lcnJvcignW1FVQUxJRlldIEVSUkVVUjonLCBlcnJvck1zZylcbiAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JNc2cpXG4gIH1cblxuICAvLyBJbml0aWFsaXNlciBsZSBjbGllbnQgT3BlbkFJXG4gIGxldCBjbGllbnRcbiAgdHJ5IHtcbiAgICBjb25zb2xlLmxvZygnW1FVQUxJRlldIEluaXRpYWxpc2F0aW9uIGR1IGNsaWVudCBPcGVuQUkuLi4nKVxuICAgIGNsaWVudCA9IG5ldyBPcGVuQUkoe1xuICAgICAgYXBpS2V5OiBhcGlLZXlcbiAgICB9KVxuICAgIGNvbnNvbGUubG9nKCdbUVVBTElGWV0gQ2xpZW50IE9wZW5BSSBpbml0aWFsaXNcdTAwRTkgYXZlYyBzdWNjXHUwMEU4cycpXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignW1FVQUxJRlldIEVSUkVVUiBsb3JzIGRlIGxcXCdpbml0aWFsaXNhdGlvbiBkdSBjbGllbnQgT3BlbkFJOicsIGVycm9yKVxuICAgIHRocm93IG5ldyBFcnJvcihgRXJyZXVyIGQnaW5pdGlhbGlzYXRpb24gT3BlbkFJOiAke2Vycm9yLm1lc3NhZ2V9YClcbiAgfVxuXG4gIC8vIFByXHUwMEU5cGFyZXIgbGUgcHJvbXB0XG4gIGNvbnN0IHByb21wdCA9IGBcblR1IGVzIHVuIGV4cGVydCBpbW1vYmlsaWVyLlxuQW5hbHlzZSBjZSBwcm9zcGVjdCBldCByZXRvdXJuZSBTVFJJQ1RFTUVOVCBjZSBKU09OIDpcblxue1xuICBcInNjb3JlXCI6IG51bWJlciAoMC0xMDApLFxuICBcIm5pdmVhdVwiOiBcImNoYXVkXCIgfCBcInRpXHUwMEU4ZGVcIiB8IFwiZnJvaWRcIixcbiAgXCJyYWlzb25cIjogXCJjb3VydGUgYW5hbHlzZVwiLFxuICBcImFjdGlvblwiOiBcImFjdGlvbiByZWNvbW1hbmRcdTAwRTllXCJcbn1cblxuRG9ublx1MDBFOWVzIDpcbiR7SlNPTi5zdHJpbmdpZnkobGVhZCwgbnVsbCwgMil9XG5gXG5cbiAgdHJ5IHtcbiAgICBjb25zb2xlLmxvZygnW1FVQUxJRlldIEFwcGVsIFx1MDBFMCBsXFwnQVBJIE9wZW5BSS4uLicpXG4gICAgY29uc29sZS5sb2coJ1tRVUFMSUZZXSBEb25uXHUwMEU5ZXMgZW52b3lcdTAwRTllczonLCBKU09OLnN0cmluZ2lmeShsZWFkLCBudWxsLCAyKSlcblxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNsaWVudC5jaGF0LmNvbXBsZXRpb25zLmNyZWF0ZSh7XG4gICAgICBtb2RlbDogXCJncHQtNG8tbWluaVwiLFxuICAgIG1lc3NhZ2VzOiBbeyByb2xlOiBcInVzZXJcIiwgY29udGVudDogcHJvbXB0IH1dLFxuICAgICAgdGVtcGVyYXR1cmU6IDAuMixcbiAgICAgIHJlc3BvbnNlX2Zvcm1hdDogeyB0eXBlOiBcImpzb25fb2JqZWN0XCIgfVxuICAgIH0pXG5cbiAgICBjb25zb2xlLmxvZygnW1FVQUxJRlldIFJcdTAwRTlwb25zZSBPcGVuQUkgcmVcdTAwRTd1ZTonLCB7XG4gICAgICBoYXNDb250ZW50OiAhIXJlc3BvbnNlPy5jaG9pY2VzPy5bMF0/Lm1lc3NhZ2U/LmNvbnRlbnQsXG4gICAgICBjb250ZW50TGVuZ3RoOiByZXNwb25zZT8uY2hvaWNlcz8uWzBdPy5tZXNzYWdlPy5jb250ZW50Py5sZW5ndGggfHwgMFxuICAgIH0pXG5cbiAgICAvLyBWXHUwMEU5cmlmaWVyIHF1ZSBsYSByXHUwMEU5cG9uc2UgY29udGllbnQgZHUgY29udGVudVxuICAgIGlmICghcmVzcG9uc2U/LmNob2ljZXM/LlswXT8ubWVzc2FnZT8uY29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSXHUwMEU5cG9uc2UgT3BlbkFJIHZpZGUgLSBhdWN1bmUgclx1MDBFOXBvbnNlIGdcdTAwRTluXHUwMEU5clx1MDBFOWUnKVxuICAgIH1cblxuICAgIGNvbnN0IHJhd0NvbnRlbnQgPSByZXNwb25zZS5jaG9pY2VzWzBdLm1lc3NhZ2UuY29udGVudFxuICAgIGNvbnNvbGUubG9nKCdbUVVBTElGWV0gQ29udGVudSBicnV0IGRlIGxhIHJcdTAwRTlwb25zZTonLCByYXdDb250ZW50LnN1YnN0cmluZygwLCAyMDApICsgJy4uLicpXG5cbiAgICAvLyBQYXJzZXIgbGUgSlNPTiBkZSBtYW5pXHUwMEU4cmUgc1x1MDBFOWN1cmlzXHUwMEU5ZVxuICAgIGxldCBxdWFsaWZpY2F0aW9uXG4gICAgdHJ5IHtcbiAgICAgIHF1YWxpZmljYXRpb24gPSBKU09OLnBhcnNlKHJhd0NvbnRlbnQpXG4gICAgICBjb25zb2xlLmxvZygnW1FVQUxJRlldIEpTT04gcGFyc1x1MDBFOSBhdmVjIHN1Y2NcdTAwRThzOicsIHF1YWxpZmljYXRpb24pXG4gICAgfSBjYXRjaCAocGFyc2VFcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW1FVQUxJRlldIEVSUkVVUiBsb3JzIGR1IHBhcnNpbmcgSlNPTjonLCBwYXJzZUVycm9yKVxuICAgICAgY29uc29sZS5lcnJvcignW1FVQUxJRlldIENvbnRlbnUgcXVpIGEgXHUwMEU5Y2hvdVx1MDBFOTonLCByYXdDb250ZW50KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBSXHUwMEU5cG9uc2UgT3BlbkFJIGludmFsaWRlIChKU09OIG5vbiB2YWxpZGUpOiAke3BhcnNlRXJyb3IubWVzc2FnZX1gKVxuICAgIH1cblxuICAgIC8vIFZhbGlkZXIgbGVzIGNoYW1wcyByZXF1aXNcbiAgICBpZiAodHlwZW9mIHF1YWxpZmljYXRpb24uc2NvcmUgIT09ICdudW1iZXInICYmIHR5cGVvZiBxdWFsaWZpY2F0aW9uLnNjb3JlICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdMZSBjaGFtcCBcInNjb3JlXCIgZXN0IG1hbnF1YW50IG91IGludmFsaWRlIGRhbnMgbGEgclx1MDBFOXBvbnNlIE9wZW5BSScpXG4gICAgfVxuXG4gICAgaWYgKCFxdWFsaWZpY2F0aW9uLm5pdmVhdSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdMZSBjaGFtcCBcIm5pdmVhdVwiIGVzdCBtYW5xdWFudCBkYW5zIGxhIHJcdTAwRTlwb25zZSBPcGVuQUknKVxuICAgIH1cblxuICAgIC8vIE5vcm1hbGlzZXIgbGEgclx1MDBFOXBvbnNlXG4gICAgY29uc3Qgbm9ybWFsaXplZFNjb3JlID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMTAwLCBwYXJzZUludChxdWFsaWZpY2F0aW9uLnNjb3JlKSB8fCAwKSlcbiAgICBjb25zdCBub3JtYWxpemVkTml2ZWF1ID0gWydjaGF1ZCcsICd0aVx1MDBFOGRlJywgJ2Zyb2lkJ10uaW5jbHVkZXMocXVhbGlmaWNhdGlvbi5uaXZlYXU/LnRvTG93ZXJDYXNlKCkpIFxuICAgICAgPyBxdWFsaWZpY2F0aW9uLm5pdmVhdS50b0xvd2VyQ2FzZSgpIFxuICAgICAgOiBudWxsXG5cbiAgICBpZiAoIW5vcm1hbGl6ZWROaXZlYXUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTml2ZWF1IGludmFsaWRlOiAke3F1YWxpZmljYXRpb24ubml2ZWF1fS4gQXR0ZW5kdTogY2hhdWQsIHRpXHUwMEU4ZGUgb3UgZnJvaWRgKVxuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgIHNjb3JlOiBub3JtYWxpemVkU2NvcmUsXG4gICAgICBuaXZlYXU6IG5vcm1hbGl6ZWROaXZlYXUsXG4gICAgICByYWlzb246IHF1YWxpZmljYXRpb24ucmFpc29uIHx8ICdBbmFseXNlIGVmZmVjdHVcdTAwRTllJyxcbiAgICAgIGFjdGlvbjogcXVhbGlmaWNhdGlvbi5hY3Rpb24gfHwgJ0NvbnRhY3RlciBsZSBwcm9zcGVjdCdcbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygnW1FVQUxJRlldIFF1YWxpZmljYXRpb24gclx1MDBFOXVzc2llOicsIHJlc3VsdClcbiAgICByZXR1cm4gcmVzdWx0XG5cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbUVVBTElGWV0gRVJSRVVSIGxvcnMgZGUgbFxcJ2FwcGVsIE9wZW5BSTonLCBlcnJvcilcbiAgICBjb25zb2xlLmVycm9yKCdbUVVBTElGWV0gU3RhY2sgdHJhY2U6JywgZXJyb3Iuc3RhY2spXG4gICAgXG4gICAgLy8gTkUgUEFTIHJldG91cm5lciBkZSBmYWxsYmFjayAtIGxhaXNzZXIgbCdlcnJldXIgcmVtb250ZXJcbiAgICB0aHJvdyBuZXcgRXJyb3IoYEVycmV1ciBkZSBxdWFsaWZpY2F0aW9uIElBOiAke2Vycm9yLm1lc3NhZ2UgfHwgJ0VycmV1ciBpbmNvbm51ZSd9YClcbiAgfVxufVxuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxocFxcXFxIcFxcXFxuZXhhcFxcXFxzcmNcXFxcc2VydmVyXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxocFxcXFxIcFxcXFxuZXhhcFxcXFxzcmNcXFxcc2VydmVyXFxcXGluZGV4LmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9ocC9IcC9uZXhhcC9zcmMvc2VydmVyL2luZGV4LmpzXCI7aW1wb3J0IHsgcXVhbGlmeUxlYWRTZXJ2ZXIgfSBmcm9tICcuL3F1YWxpZnknXG5cbi8qKlxuICogSGFuZGxlciBwb3VyIGxhIHJvdXRlIC9hcGkvcXVhbGlmeVxuICogR2FyYW50aXQgVE9VSk9VUlMgdW5lIHJcdTAwRTlwb25zZSBKU09OIHZhbGlkZSwgbVx1MDBFQW1lIGVuIGNhcyBkJ2VycmV1clxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaGFuZGxlUXVhbGlmeShyZXEpIHtcbiAgdHJ5IHtcbiAgICAvLyBWXHUwMEU5cmlmaWVyIHF1ZSBsYSByZXF1XHUwMEVBdGUgZXN0IGJpZW4gdW5lIHJlcXVcdTAwRUF0ZSBQT1NUXG4gICAgaWYgKHJlcS5tZXRob2QgIT09ICdQT1NUJykge1xuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgICAgIG1lc3NhZ2U6ICdNXHUwMEU5dGhvZGUgbm9uIGF1dG9yaXNcdTAwRTllLiBVdGlsaXNleiBQT1NULidcbiAgICAgICAgfSksXG4gICAgICAgIHtcbiAgICAgICAgICBzdGF0dXM6IDQwNSxcbiAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfVxuICAgICAgICB9XG4gICAgICApXG4gICAgfVxuXG4gICAgLy8gUGFyc2VyIGxlIGJvZHkgZGUgbWFuaVx1MDBFOHJlIHNcdTAwRTljdXJpc1x1MDBFOWVcbiAgICBsZXQgYm9keVxuICAgIHRyeSB7XG4gICAgICBib2R5ID0gYXdhaXQgcmVxLmpzb24oKVxuICAgIH0gY2F0Y2ggKHBhcnNlRXJyb3IpIHtcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBlcnJvcjogdHJ1ZSxcbiAgICAgICAgICBtZXNzYWdlOiAnQ29ycHMgZGUgbGEgcmVxdVx1MDBFQXRlIGludmFsaWRlIChKU09OIGF0dGVuZHUpJ1xuICAgICAgICB9KSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICAgIH1cbiAgICAgIClcbiAgICB9XG5cbiAgICAvLyBWYWxpZGVyIGxlcyBkb25uXHUwMEU5ZXMgbWluaW1hbGVzIHJlcXVpc2VzXG4gICAgaWYgKCFib2R5IHx8IHR5cGVvZiBib2R5ICE9PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgICAgIG1lc3NhZ2U6ICdEb25uXHUwMEU5ZXMgaW52YWxpZGVzJ1xuICAgICAgICB9KSxcbiAgICAgICAge1xuICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICAgIH1cbiAgICAgIClcbiAgICB9XG5cbiAgICAvLyBBcHBlbGVyIGxhIGZvbmN0aW9uIGRlIHF1YWxpZmljYXRpb25cbiAgICAvLyBDZXR0ZSBmb25jdGlvbiBwZXV0IG1haW50ZW5hbnQgbGFuY2VyIHVuZSBlcnJldXIgc2kgT3BlbkFJIG4nZXN0IHBhcyBjb25maWd1clx1MDBFOVxuICAgIGNvbnNvbGUubG9nKCdbQVBJXSBBcHBlbCBkZSBxdWFsaWZ5TGVhZFNlcnZlciBhdmVjOicsIHtcbiAgICAgIG5vbTogYm9keS5ub20sXG4gICAgICBlbWFpbDogYm9keS5lbWFpbCxcbiAgICAgIGJ1ZGdldDogYm9keS5idWRnZXRcbiAgICB9KVxuXG4gICAgbGV0IHJlc3VsdFxuICAgIHRyeSB7XG4gICAgICByZXN1bHQgPSBhd2FpdCBxdWFsaWZ5TGVhZFNlcnZlcihib2R5KVxuICAgICAgY29uc29sZS5sb2coJ1tBUEldIFF1YWxpZmljYXRpb24gclx1MDBFOXVzc2llOicsIHJlc3VsdClcbiAgICB9IGNhdGNoIChxdWFsaWZ5RXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBUEldIEVycmV1ciBsb3JzIGRlIGxhIHF1YWxpZmljYXRpb246JywgcXVhbGlmeUVycm9yKVxuICAgICAgLy8gUmV0b3VybmVyIGwnZXJyZXVyIGRlIG1hbmlcdTAwRThyZSBleHBsaWNpdGUgYXUgZnJvbnRlbmRcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBlcnJvcjogdHJ1ZSxcbiAgICAgICAgICBtZXNzYWdlOiBxdWFsaWZ5RXJyb3IubWVzc2FnZSB8fCAnRXJyZXVyIGxvcnMgZGUgbGEgcXVhbGlmaWNhdGlvbicsXG4gICAgICAgICAgZGV0YWlsczogcXVhbGlmeUVycm9yLnN0YWNrXG4gICAgICAgIH0pLFxuICAgICAgICB7XG4gICAgICAgICAgc3RhdHVzOiA1MDAsXG4gICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH1cbiAgICAgICAgfVxuICAgICAgKVxuICAgIH1cblxuICAgIC8vIFJldG91cm5lciBsZSByXHUwMEU5c3VsdGF0IGF2ZWMgdW4gc3RhdHV0IDIwMFxuICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXG4gICAgICBKU09OLnN0cmluZ2lmeShyZXN1bHQpLFxuICAgICAge1xuICAgICAgICBzdGF0dXM6IDIwMCxcbiAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH1cbiAgICAgIH1cbiAgICApXG5cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyBDYXRjaCBmaW5hbCBwb3VyIHRvdXRlIGVycmV1ciBub24gZ1x1MDBFOXJcdTAwRTllXG4gICAgY29uc29sZS5lcnJvcignW0FQSV0gRXJyZXVyIGNyaXRpcXVlIGRhbnMgaGFuZGxlUXVhbGlmeTonLCBlcnJvcilcbiAgICBjb25zb2xlLmVycm9yKCdbQVBJXSBTdGFjayB0cmFjZTonLCBlcnJvci5zdGFjaylcbiAgICBcbiAgICAvLyBSZXRvdXJuZXIgbCdlcnJldXIgZGUgbWFuaVx1MDBFOHJlIGV4cGxpY2l0ZSAoc2FucyBmYWxsYmFjayBzaWxlbmNpZXV4KVxuICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXG4gICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGVycm9yOiB0cnVlLFxuICAgICAgICBtZXNzYWdlOiBgRXJyZXVyIHRlY2huaXF1ZTogJHtlcnJvci5tZXNzYWdlIHx8ICdFcnJldXIgaW5jb25udWUnfWAsXG4gICAgICAgIGRldGFpbHM6IGVycm9yLnN0YWNrXG4gICAgICB9KSxcbiAgICAgIHtcbiAgICAgICAgc3RhdHVzOiA1MDAsXG4gICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9XG4gICAgICB9XG4gICAg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

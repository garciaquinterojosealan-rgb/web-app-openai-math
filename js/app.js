// ===========================================
// 🔐 CARGA DINÁMICA DE API KEY DESDE MockAPI
// ===========================================

/**
 * Variable global para almacenar la API Key
 * obtenida desde el endpoint MockAPI.
 */
let OPENAI_API_KEY = null;

/**
 * Obtiene la API Key desde MockAPI por medio de fetch().
 * MockAPI devuelve un array de objetos con el campo "apiKey".
 */
async function loadApiKey() {
  try {
    const response = await fetch("https://690a3da01a446bb9cc21eb68.mockapi.io/apiKeyOpenAI");

    if (!response.ok) {
      throw new Error(`Error HTTP al consultar MockAPI: ${response.status}`);
    }

    const data = await response.json();

    // Si la respuesta es un array de objetos
    if (Array.isArray(data) && data.length > 0 && data[0].apiKey) {
      OPENAI_API_KEY = data[0].apiKey;
    }
    // Si es un objeto único
    else if (data.apiKey) {
      OPENAI_API_KEY = data.apiKey;
    } else {
      throw new Error("La respuesta de MockAPI no contiene el campo 'apiKey'.");
    }

    console.log("✅ API Key obtenida correctamente desde MockAPI.");
    return true;
  } catch (error) {
    console.error("❌ Error al obtener la API Key desde MockAPI:", error);
    return false;
  }
}

// ===========================================
// 🎯 VARIABLES DE INTERFAZ (DOM)
// ===========================================

const btnEvaluate = document.getElementById("btnEvaluate");
const btnClear = document.getElementById("btnClear");
const operationInput = document.getElementById("operationInput");
const statusMessage = document.getElementById("statusMessage");
const resultValue = document.getElementById("resultValue");
const resultLatex = document.getElementById("resultLatex");

// ===========================================
// 🧮 LÓGICA PRINCIPAL
// ===========================================

btnEvaluate.addEventListener("click", async () => {
  const operation = operationInput.value.trim();

  if (!operation) {
    statusMessage.textContent = "Escribe una operación primero.";
    statusMessage.classList.remove("text-muted");
    statusMessage.classList.add("text-danger");
    return;
  }

  // 🔸 Verificar si la API key ya fue cargada; si no, cargarla
  if (!OPENAI_API_KEY) {
    statusMessage.textContent = "Obteniendo API Key desde MockAPI...";
    const loaded = await loadApiKey();
    if (!loaded || !OPENAI_API_KEY) {
      statusMessage.textContent = "Error: no se pudo obtener la API Key.";
      statusMessage.classList.remove("text-success", "text-muted");
      statusMessage.classList.add("text-danger");
      return;
    }
  }

  // Mostrar estado de carga
  statusMessage.textContent = "Consultando OpenAI...";
  statusMessage.classList.remove("text-danger");
  statusMessage.classList.add("text-muted");

  resultValue.innerHTML = '<span class="text-muted">Calculando…</span>';
  resultLatex.innerHTML = '<span class="text-muted">Calculando…</span>';

  try {
    // ===========================================
    // 📡 LLAMADA A LA API DE OPENAI CON FETCH()
    // ===========================================
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`, // 🔐 obtenida de MockAPI
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `
          Eres una calculadora matemática.
          Debes evaluar la siguiente operación de manera precisa.

          Reglas IMPORTANTES:
          - Responde ÚNICAMENTE un JSON válido.
          - El JSON debe tener exactamente estos campos:
            {
              "resultado": number,
              "latex": string
            }
          - "resultado" es el valor numérico final de la operación.
          - "latex" es una expresión en LaTeX que muestre la operación y el resultado.
          - NO uses bloques de código, NO uses \`\`\`, NO pongas la palabra json.
          - Responde solo el JSON, sin texto adicional.

          Operación: ${operation}
        `,
        temperature: 0, // determinismo para cálculos
      }),
    });

    // Manejo de errores HTTP
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error HTTP:", response.status, errorText);
      throw new Error(`Error HTTP ${response.status}`);
    }

    // Procesar respuesta JSON
    const data = await response.json();
    console.log("Respuesta completa de OpenAI:", data);

    // Intentar obtener el texto plano de salida
    let rawText = data.output_text;
    if (!rawText && data.output && data.output[0]?.content?.[0]?.text) {
      rawText = data.output[0].content[0].text;
    }

    if (!rawText) throw new Error("No se encontró texto en la respuesta de OpenAI.");

    rawText = rawText.trim();

    // Limpieza de posibles bloques ```
    if (rawText.startsWith("```")) {
      const firstNewline = rawText.indexOf("\n");
      if (firstNewline !== -1) rawText = rawText.slice(firstNewline + 1);
      if (rawText.endsWith("```")) rawText = rawText.slice(0, -3);
      rawText = rawText.trim();
    }

    // Parsear JSON devuelto por el modelo
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.error("No se pudo parsear el JSON:", rawText);
      throw new Error("La IA no regresó un JSON limpio o válido.");
    }

    const { resultado, latex } = parsed;
    if (resultado === undefined || typeof latex !== "string") {
      throw new Error("El JSON no contiene los campos 'resultado' y 'latex'.");
    }

    // Mostrar resultado
    resultValue.textContent = resultado;
    resultLatex.innerHTML = `$$${latex}$$`;

    // Render con MathJax si está presente
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise();
    }

    statusMessage.textContent = "Operación evaluada correctamente ✅";
    statusMessage.classList.remove("text-danger");
    statusMessage.classList.add("text-success");
  } catch (err) {
    console.error(err);
    statusMessage.textContent = "Ocurrió un error al llamar a la API o parsear el JSON.";
    statusMessage.classList.remove("text-success", "text-muted");
    statusMessage.classList.add("text-danger");
    resultValue.innerHTML = '<span class="text-muted">Sin resultado por error…</span>';
    resultLatex.innerHTML = '<span class="text-muted">Sin resultado por error…</span>';
  }
});

// ===========================================
// 🧹 LIMPIAR RESULTADOS
// ===========================================

btnClear.addEventListener("click", () => {
  operationInput.value = "";
  statusMessage.textContent = "";
  resultValue.innerHTML = '<span class="text-muted">Sin resultado aún…</span>';
  resultLatex.innerHTML = '<span class="text-muted">Sin resultado aún…</span>';
});

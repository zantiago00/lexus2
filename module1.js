// =============================================================================
// LexTerminus v2.1 - Modulo 1: Core Logic & Data Management
// Autor: [Tu Nombre/AI]
// Fecha: 2025-04-26
// Descripción: Maneja la lógica central de la aplicación, incluyendo:
// - Gestión de datos (localStorage) para términos y configuración.
// - Cálculos de fechas de vencimiento (días hábiles, festivos).
// - Cálculo de días restantes.
// - Generación de IDs únicos.
// - Funciones de exportación e importación de datos (CSV).
// - Definición de constantes y valores por defecto.
// =============================================================================

// Strict mode para mejor calidad de código
"use strict";

// --- Constantes Globales del Módulo ---

/** @const {string} Clave para almacenar la configuración en localStorage. */
const CONFIG_KEY = 'lexTerminusConfig_v2_1';

/** @const {string} Clave para almacenar los datos (términos) en localStorage. */
const DATA_KEY = 'lexTerminusData_v2_1';

/**
 * @typedef {object} TerminoProcesal
 * @property {string} id - Identificador único del término.
 * @property {string} expediente - Número de expediente o radicado.
 * @property {string} [juzgado] - Juzgado o despacho asociado.
 * @property {string} tipoValue - Valor interno del tipo de término (select value).
 * @property {string} tipoText - Texto descriptivo del tipo de término.
 * @property {string} fechaInicio - Fecha de inicio del término (YYYY-MM-DD).
 * @property {number} dias - Número de días hábiles del término.
 * @property {string} fechaVencimiento - Fecha de vencimiento calculada (YYYY-MM-DD).
 * @property {string|null} [horaVencimiento] - Hora límite opcional (HH:mm).
 * @property {string} [notas] - Notas adicionales.
 * @property {string} fechaRegistro - Timestamp ISO de cuándo se registró/actualizó el término.
 */

/**
 * @typedef {object} AppConfig
 * @property {string} holidays - String con fechas festivas (YYYY-MM-DD), una por línea.
 * @property {number} warningDays - Días para alerta de advertencia.
 * @property {number} urgentDays - Días para alerta urgente.
 * @property {number} itemsPerPage - Número de ítems por página en tablas.
 */

// --- Valores Predeterminados ---

/**
 * Configuración predeterminada de la aplicación.
 * @type {AppConfig}
 */
const DEFAULT_CONFIG = Object.freeze({
    holidays: [
        // Festivos Colombia 2025 (Ejemplo - ¡VERIFICAR Y ACTUALIZAR ANUALMENTE!)
        "2025-01-01", // Año Nuevo
        "2025-01-06", // Reyes Magos
        "2025-03-24", // San José
        "2025-04-17", // Jueves Santo
        "2025-04-18", // Viernes Santo
        "2025-05-01", // Día del Trabajo
        "2025-06-02", // Ascensión del Señor
        "2025-06-23", // Corpus Christi
        "2025-06-30", // San Pedro y San Pablo
        "2025-07-20", // Independencia de Colombia
        "2025-08-07", // Batalla de Boyacá
        "2025-08-18", // Asunción de la Virgen
        "2025-10-13", // Día de la Raza
        "2025-11-03", // Todos los Santos
        "2025-11-17", // Independencia de Cartagena
        "2025-12-08", // Inmaculada Concepción
        "2025-12-25"  // Navidad
        // Añadir festivos 2026, etc. según sea necesario
        // Festivos Colombia 2026 (Ejemplo Provisional - VERIFICAR)
        // "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03",
        // "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-07-20",
        // "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16",
        // "2026-12-08", "2026-12-25"
    ].join('\n'), // Almacenar como string multilínea para el textarea
    warningDays: 5,
    urgentDays: 2,
    itemsPerPage: 25,
});

// --- Estado Interno del Módulo ---

/**
 * Almacena la configuración actual cargada.
 * @type {AppConfig | null}
 */
let currentConfig = null;

/**
 * Almacena la lista procesada de días festivos.
 * @type {Set<string>}
 */
let holidaySet = new Set();

// --- Gestión de Configuración ---

/**
 * Carga la configuración desde localStorage o usa los valores predeterminados.
 * Inicializa el estado interno 'currentConfig' y 'holidaySet'.
 * @returns {AppConfig} La configuración cargada o predeterminada.
 */
function loadConfig() {
    if (currentConfig) {
        // console.debug("Config already loaded, returning cached version."); // Debugging
        return currentConfig;
    }

    console.log("Attempting to load configuration...");
    let loadedConfig = { ...DEFAULT_CONFIG }; // Start with defaults

    try {
        const storedConfigStr = localStorage.getItem(CONFIG_KEY);
        if (storedConfigStr) {
            console.log("Found stored configuration.");
            const parsedConfig = JSON.parse(storedConfigStr);
            // Merge parsed config with defaults to ensure all keys exist
            loadedConfig = {
                ...DEFAULT_CONFIG,
                ...parsedConfig,
                // Ensure specific types after parsing JSON
                warningDays: parseInt(parsedConfig.warningDays || DEFAULT_CONFIG.warningDays, 10),
                urgentDays: parseInt(parsedConfig.urgentDays || DEFAULT_CONFIG.urgentDays, 10),
                itemsPerPage: parseInt(parsedConfig.itemsPerPage || DEFAULT_CONFIG.itemsPerPage, 10),
                holidays: typeof parsedConfig.holidays === 'string' ? parsedConfig.holidays : DEFAULT_CONFIG.holidays,
            };
            console.log("Configuration parsed successfully.");
        } else {
            console.log("No stored configuration found, using defaults.");
            // Save defaults if nothing was stored before
            saveConfig(loadedConfig, false); // Save without immediate recalculation
        }
    } catch (error) {
        console.error("Error loading or parsing configuration from localStorage:", error);
        // Fallback to default config in case of error
        loadedConfig = { ...DEFAULT_CONFIG };
        // Optionally notify user about the error using a generic mechanism if available early
        // showMessage("Error al cargar la configuración. Usando valores predeterminados.", "error");
    }

    // Update internal state
    currentConfig = loadedConfig;
    updateHolidaySet(currentConfig.holidays);
    console.log(`Configuration loaded: ${JSON.stringify(Object.keys(currentConfig))} keys.`);
    // console.debug("Loaded config details:", currentConfig); // Debugging

    return currentConfig;
}

/**
 * Guarda la configuración proporcionada en localStorage.
 * Actualiza el estado interno 'currentConfig' y 'holidaySet'.
 * @param {AppConfig} configToSave - El objeto de configuración a guardar.
 * @param {boolean} [triggerRecalculation=true] - Indica si se debe recalcular las fechas de vencimiento de todos los términos.
 * @returns {boolean} `true` si se guardó correctamente, `false` en caso contrario.
 */
function saveConfig(configToSave, triggerRecalculation = true) {
    console.log("Attempting to save configuration...");
    if (!configToSave || typeof configToSave !== 'object') {
        console.error("Invalid configuration object provided for saving.");
        return false;
    }

    try {
        // Validate data types before saving
        const validatedConfig = {
            holidays: typeof configToSave.holidays === 'string' ? configToSave.holidays : DEFAULT_CONFIG.holidays,
            warningDays: parseInt(configToSave.warningDays, 10) || DEFAULT_CONFIG.warningDays,
            urgentDays: parseInt(configToSave.urgentDays, 10) || DEFAULT_CONFIG.urgentDays,
            itemsPerPage: parseInt(configToSave.itemsPerPage, 10) || DEFAULT_CONFIG.itemsPerPage,
        };

        // Ensure values are within reasonable bounds (optional but good practice)
        validatedConfig.warningDays = Math.max(1, validatedConfig.warningDays);
        validatedConfig.urgentDays = Math.max(0, validatedConfig.urgentDays);
        const validItemsPerPage = [10, 25, 50, 100];
        if (!validItemsPerPage.includes(validatedConfig.itemsPerPage)) {
            validatedConfig.itemsPerPage = DEFAULT_CONFIG.itemsPerPage;
        }


        localStorage.setItem(CONFIG_KEY, JSON.stringify(validatedConfig));
        console.log("Configuration saved successfully to localStorage.");

        // Update internal state
        currentConfig = validatedConfig;
        updateHolidaySet(currentConfig.holidays); // Update holiday set immediately

        // Trigger recalculation if requested and necessary
        if (triggerRecalculation) {
             // Check if holidays actually changed before triggering full recalculation
            const oldHolidays = localStorage.getItem(CONFIG_KEY + '_lastHolidays'); // Temporary storage for comparison
            if (oldHolidays !== validatedConfig.holidays) {
                 console.log("Holidays changed, triggering recalculation of due dates.");
                 recalculateAllDueDates(); // This function needs access to DataManager or similar
                 localStorage.setItem(CONFIG_KEY + '_lastHolidays', validatedConfig.holidays); // Update the comparison value
            } else {
                 console.log("Configuration saved, but holidays did not change. No recalculation needed.");
            }
        }

        return true;
    } catch (error) {
        console.error("Error saving configuration to localStorage:", error);
        // Handle potential storage errors (e.g., QuotaExceededError)
        if (error.name === 'QuotaExceededError') {
             console.error("Storage quota exceeded. Cannot save configuration.");
             // Notify the user appropriately via UI
             // showMessage("Error: Espacio de almacenamiento lleno. No se pudo guardar la configuración.", "error");
        } else {
             // showMessage("Error desconocido al guardar la configuración.", "error");
        }
        return false;
    }
}

/**
 * Restaura la configuración a los valores predeterminados.
 * @param {boolean} [triggerRecalculation=true] - Si se deben recalcular las fechas.
 * @returns {boolean} True si se restauró y guardó correctamente.
 */
function resetConfigToDefaults(triggerRecalculation = true) {
    console.warn("Resetting configuration to defaults.");
    currentConfig = { ...DEFAULT_CONFIG }; // Reset internal state first
    return saveConfig(currentConfig, triggerRecalculation);
}


/**
 * Actualiza el Set interno de días festivos a partir del string de configuración.
 * @param {string} holidaysString - El string multilínea con las fechas festivas.
 */
function updateHolidaySet(holidaysString) {
    console.log("Updating internal holiday set...");
    holidaySet.clear(); // Clear previous holidays
    if (typeof holidaysString !== 'string' || holidaysString.trim() === '') {
        console.warn("Holiday string is empty or invalid. Holiday set will be empty.");
        return;
    }
    const lines = holidaysString.split('\n');
    let addedCount = 0;
    let invalidCount = 0;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/; // Basic YYYY-MM-DD validation

    lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && dateRegex.test(trimmedLine)) {
            // Further validation: Check if the date is actually valid
            const dateParts = trimmedLine.split('-').map(Number);
            const dateObj = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
            // Check if the constructed date matches the input string parts
             if (dateObj.getUTCFullYear() === dateParts[0] &&
                dateObj.getUTCMonth() === dateParts[1] - 1 &&
                dateObj.getUTCDate() === dateParts[2])
            {
                holidaySet.add(trimmedLine);
                addedCount++;
            } else {
                console.warn(`Invalid date found in holidays list: ${trimmedLine}`);
                invalidCount++;
            }

        } else if (trimmedLine) {
            console.warn(`Invalid format found in holidays list (expected YYYY-MM-DD): ${trimmedLine}`);
            invalidCount++;
        }
    });
    console.log(`Holiday set updated: ${addedCount} valid holidays added, ${invalidCount} invalid entries ignored.`);
    // console.debug("Current holiday set:", Array.from(holidaySet)); // Debugging
}

/**
 * Obtiene la configuración actual cargada. Si no está cargada, la carga primero.
 * @returns {AppConfig} La configuración actual.
 */
function getCurrentConfig() {
    if (!currentConfig) {
        console.log("Config not yet loaded, loading now...");
        loadConfig();
    }
     // Return a copy to prevent accidental modification? Deep copy might be expensive.
     // For now, return direct reference assuming modules behave.
    return currentConfig;
}

// --- Gestión de Datos (Términos) ---

/**
 * Carga la lista de términos desde localStorage.
 * @returns {TerminoProcesal[]} Un array de objetos TerminoProcesal. Retorna array vacío si no hay datos o hay error.
 */
function loadData() {
    console.log("Attempting to load term data...");
    try {
        const storedDataStr = localStorage.getItem(DATA_KEY);
        if (storedDataStr) {
            const parsedData = JSON.parse(storedDataStr);
            // Basic validation: check if it's an array
            if (Array.isArray(parsedData)) {
                console.log(`Successfully loaded ${parsedData.length} terms from localStorage.`);
                // Optional: Deeper validation of each term object structure here if needed
                return parsedData;
            } else {
                console.warn("Stored data is not an array. Returning empty array.");
                // Optionally try to recover or clear invalid data
                // localStorage.removeItem(DATA_KEY); // Be cautious with auto-deletion
                return [];
            }
        } else {
            console.log("No term data found in localStorage. Returning empty array.");
            return []; // No data stored yet
        }
    } catch (error) {
        console.error("Error loading or parsing term data from localStorage:", error);
        // showMessage("Error crítico al cargar los datos guardados. Contacte soporte si el problema persiste.", "error");
        return []; // Return empty array on error to prevent app crash
    }
}

/**
 * Guarda la lista completa de términos en localStorage.
 * @param {TerminoProcesal[]} dataToSave - El array de términos a guardar.
 * @returns {boolean} `true` si se guardó correctamente, `false` en caso contrario.
 */
function saveData(dataToSave) {
    console.log(`Attempting to save ${dataToSave.length} terms...`);
    if (!Array.isArray(dataToSave)) {
        console.error("Invalid data provided for saving: not an array.");
        return false;
    }

    try {
        // Optional: Sanitize data before saving (e.g., remove transient properties)
        const dataAsString = JSON.stringify(dataToSave);
        localStorage.setItem(DATA_KEY, dataAsString);
        console.log("Term data saved successfully to localStorage.");
        return true;
    } catch (error) {
        console.error("Error saving term data to localStorage:", error);
         if (error.name === 'QuotaExceededError') {
             console.error("Storage quota exceeded. Cannot save term data.");
             // Notify the user appropriately via UI
             // showMessage("Error: Espacio de almacenamiento lleno. No se pudieron guardar los términos.", "error");
             // Consider strategies like asking user to delete old data or exporting.
        } else {
             // showMessage("Error desconocido al guardar los datos de términos.", "error");
        }
        return false;
    }
}

/**
 * Añade o actualiza un término en la lista de datos y guarda.
 * @param {TerminoProcesal} term - El objeto término a añadir o actualizar.
 * @returns {boolean} True si la operación fue exitosa.
 */
function saveOrUpdateTerm(term) {
    if (!term || !term.id) {
        console.error("Invalid term object provided for saving/updating.");
        return false;
    }
    console.log(`Saving/Updating term with ID: ${term.id}`);
    let data = loadData();
    const index = data.findIndex(t => t.id === term.id);

    // Add timestamp for registration/update
    term.fechaRegistro = new Date().toISOString();

    if (index > -1) {
        // Update existing term
        console.log("Updating existing term.");
        data[index] = term;
    } else {
        // Add new term
        console.log("Adding new term.");
        data.push(term);
    }
    return saveData(data);
}

/**
 * Elimina un término por su ID y guarda los cambios.
 * @param {string} termId - El ID del término a eliminar.
 * @returns {boolean} True si se eliminó y guardó correctamente.
 */
function deleteTermById(termId) {
     if (!termId) {
        console.error("Invalid term ID provided for deletion.");
        return false;
    }
    console.log(`Attempting to delete term with ID: ${termId}`);
    let data = loadData();
    const initialLength = data.length;
    data = data.filter(t => t.id !== termId);

    if (data.length < initialLength) {
        console.log("Term found and marked for deletion.");
        return saveData(data);
    } else {
        console.warn(`Term with ID ${termId} not found for deletion.`);
        return false; // Term not found, nothing to save
    }
}

/**
 * Elimina todos los términos guardados. ¡Acción irreversible!
 * @returns {boolean} True si se eliminaron los datos correctamente.
 */
function deleteAllTerms() {
    console.warn("Attempting to delete ALL term data!");
    try {
        localStorage.removeItem(DATA_KEY);
        console.log("All term data successfully removed from localStorage.");
        return true;
    } catch (error) {
        console.error("Error removing term data from localStorage:", error);
        // showMessage("Error al intentar borrar todos los datos.", "error");
        return false;
    }
}


// --- Lógica de Cálculo de Fechas ---

/**
 * Verifica si una fecha (objeto Date) cae en fin de semana (sábado o domingo).
 * Usa UTC para consistencia.
 * @param {Date} date - El objeto Date a verificar.
 * @returns {boolean} `true` si es sábado o domingo, `false` en caso contrario.
 */
function isWeekend(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        console.warn("isWeekend received an invalid Date object.");
        return false; // Treat invalid dates as non-weekends? Or throw error?
    }
    const day = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
    return day === 0 || day === 6;
}

/**
 * Verifica si una fecha (objeto Date) es un día festivo según la configuración cargada.
 * Compara en formato YYYY-MM-DD.
 * @param {Date} date - El objeto Date a verificar.
 * @returns {boolean} `true` si es un día festivo, `false` en caso contrario.
 */
function isHoliday(date) {
     if (!(date instanceof Date) || isNaN(date.getTime())) {
        console.warn("isHoliday received an invalid Date object.");
        return false;
    }
    // Ensure holidaySet is loaded (might happen if called before loadConfig completes)
    if (holidaySet.size === 0 && !currentConfig) {
        loadConfig(); // Load config if not already loaded
    }

    // Format the date consistently as YYYY-MM-DD using UTC methods
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const day = String(date.getUTCDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    return holidaySet.has(dateString);
}

/**
 * Calcula la fecha de vencimiento sumando días hábiles a una fecha de inicio.
 * Excluye fines de semana y días festivos configurados.
 * @param {string} fechaInicioStr - La fecha de inicio en formato YYYY-MM-DD.
 * @param {number} diasHabiles - El número de días hábiles a sumar (entero >= 0).
 * @returns {string | null} La fecha de vencimiento calculada en formato YYYY-MM-DD, o null si hay error.
 */
function calculateDueDate(fechaInicioStr, diasHabiles) {
    console.log(`Calculating due date: start=${fechaInicioStr}, days=${diasHabiles}`);

    // --- Input Validation ---
    if (typeof fechaInicioStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicioStr)) {
        console.error("Invalid start date format provided:", fechaInicioStr);
        return null;
    }
    if (typeof diasHabiles !== 'number' || !Number.isInteger(diasHabiles) || diasHabiles < 0) {
        console.error("Invalid number of business days provided:", diasHabiles);
        return null;
    }

     // --- Date Parsing and Initial Checks ---
     let startDate;
     try {
         // Parse date as UTC midnight to avoid timezone pitfalls during calculation
         startDate = new Date(fechaInicioStr + 'T00:00:00Z');
         if (isNaN(startDate.getTime())) {
             throw new Error("Parsed start date is invalid");
         }
         // Additional check for date validity (e.g., month/day ranges)
        const parts = fechaInicioStr.split('-').map(Number);
        if (startDate.getUTCFullYear() !== parts[0] || startDate.getUTCMonth() !== parts[1] - 1 || startDate.getUTCDate() !== parts[2]) {
            throw new Error(`Date ${fechaInicioStr} is logically invalid (e.g., Feb 30)`);
        }

     } catch (error) {
         console.error("Error parsing start date:", error);
         return null;
     }

     // Ensure holidays are loaded
     if (!currentConfig) loadConfig();


     // --- Calculation Logic ---
     let currentDate = new Date(startDate.getTime()); // Use UTC time for calculations
     let businessDaysCounted = 0;

     // Handle edge case: 0 days means due date is the start date IF it's a business day.
     // The common interpretation is the term *ends* after N days, so day 1 is the next business day.
     // If 0 days means "same day", the logic might need adjustment based on exact legal requirement.
     // Current logic: N days means N business days *after* the start date.
     // If diasHabiles is 0, it means the action must happen *before* the end of the start date,
     // or it might mean an action within an audience, so vencimiento is the same day.
     // Let's return start date for 0 days, assuming it's valid.
     if (diasHabiles === 0) {
         // Check if the start date itself is a non-working day. If so, what's the rule?
         // Usually, if notification happens on non-working day, term starts next working day.
         // Let's assume the *input* fechaInicio is already the correct *start* of the term.
         console.log("0 business days requested, returning start date.");
         return fechaInicioStr; // Return the start date itself
         // Alternative: Find the *first* business day on or after start date? More complex rule.
     }

    const MAX_ITERATIONS = diasHabiles * 5 + 100; // Safety break for infinite loops
    let iterations = 0;

     while (businessDaysCounted < diasHabiles && iterations < MAX_ITERATIONS) {
         // Advance date by one calendar day (using UTC)
         currentDate.setUTCDate(currentDate.getUTCDate() + 1);

         // Check if the *new* day is a business day
         if (!isWeekend(currentDate) && !isHoliday(currentDate)) {
             businessDaysCounted++;
         }
         iterations++;
     }

     if (iterations >= MAX_ITERATIONS) {
        console.error(`Calculation exceeded maximum iterations (${MAX_ITERATIONS}). Potential issue with holidays or logic. Start: ${fechaInicioStr}, Days: ${diasHabiles}`);
        return null; // Indicate error
     }


    // --- Format Output ---
    try {
        const finalYear = currentDate.getUTCFullYear();
        const finalMonth = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
        const finalDay = String(currentDate.getUTCDate()).padStart(2, '0');
        const dueDateStr = `${finalYear}-${finalMonth}-${finalDay}`;
        console.log(`Calculated due date: ${dueDateStr}`);
        return dueDateStr;
    } catch (error) {
        console.error("Error formatting final due date:", error);
        return null;
    }
}


/**
 * Calcula los días hábiles restantes entre hoy y una fecha de vencimiento.
 * @param {string} dueDateStr - La fecha de vencimiento en formato YYYY-MM-DD.
 * @returns {{days: number, text: string, isPast: boolean, isToday: boolean } | null}
 * Objeto con:
 * - days: Número de días hábiles restantes (positivo), 0 si vence hoy, negativo si está vencido.
 * - text: Texto descriptivo (e.g., "3 día(s)", "Vence Hoy", "1 día(s) Vencido").
 * - isPast: Booleano indicando si la fecha ya pasó.
 * - isToday: Booleano indicando si la fecha es hoy.
 * Retorna null si la fecha es inválida.
 */
function calculateDaysRemaining(dueDateStr) {
     // --- Input Validation ---
    if (typeof dueDateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) {
        console.error("Invalid due date format for remaining days calculation:", dueDateStr);
        return null;
    }

     // --- Date Parsing and Comparison Setup ---
    let dueDate;
    try {
        // Parse due date as UTC midnight
        dueDate = new Date(dueDateStr + 'T00:00:00Z');
         if (isNaN(dueDate.getTime())) throw new Error("Parsed due date is invalid");
         // Validate logical date
         const parts = dueDateStr.split('-').map(Number);
        if (dueDate.getUTCFullYear() !== parts[0] || dueDate.getUTCMonth() !== parts[1] - 1 || dueDate.getUTCDate() !== parts[2]) {
            throw new Error(`Due date ${dueDateStr} is logically invalid`);
        }
    } catch (error) {
        console.error("Error parsing due date:", error);
        return null;
    }

    // Get today's date, normalized to midnight UTC for fair comparison
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight

    // Ensure holidays are loaded
    if (!currentConfig) loadConfig();

    // --- Comparison and Calculation ---
    const timeDiff = dueDate.getTime() - today.getTime();

    if (timeDiff < 0) {
        // --- Due date is in the past ---
        let businessDaysPast = 0;
        let tempDate = new Date(dueDate.getTime()); // Start from due date
        const MAX_PAST_ITERATIONS = 365 * 5; // Safety break for very old dates
        let iterations = 0;

        // Count business days between dueDate (exclusive) and today (inclusive)
        while (tempDate < today && iterations < MAX_PAST_ITERATIONS) {
            tempDate.setUTCDate(tempDate.getUTCDate() + 1); // Move forward one day
             // Only count if the day *after* the due date and up to yesterday was a business day
            if (tempDate < today) { // Exclude today itself from this count
                if (!isWeekend(tempDate) && !isHoliday(tempDate)) {
                    businessDaysPast++;
                }
            } else if (tempDate.getTime() === today.getTime()){ // Special check for today
                 // If today is a business day, it counts towards the "past due" period
                 // Let's count business days *strictily* between due date and today
                 // Example: Due Mon, today is Wed. Count is 1 (Tuesday).
                  if (!isWeekend(tempDate) && !isHoliday(tempDate)) {
                     // This logic gets complex. Simpler: return calendar days past.
                     // Let's stick to simple negative difference.
                     // businessDaysPast++; // Maybe don't increment here?
                 }
            }
            iterations++;
        }

        // Use calendar days past for simplicity, as business days past is complex to define universally
        const calendarDaysPast = Math.abs(Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
        return {
            days: -calendarDaysPast, // Use negative calendar days as indicator
            text: `${calendarDaysPast} día(s) Vencido`,
            isPast: true,
            isToday: false
        };

    } else if (timeDiff === 0) {
        // --- Due date is today ---
        return { days: 0, text: 'Vence Hoy', isPast: false, isToday: true };

    } else {
        // --- Due date is in the future ---
        let businessDaysRemaining = 0;
        let tempDate = new Date(today.getTime()); // Start from today
        const MAX_FUTURE_ITERATIONS = 365 * 10; // Safety for long terms
        let iterations = 0;

        // Count business days between today (exclusive) and dueDate (inclusive)
        while (tempDate < dueDate && iterations < MAX_FUTURE_ITERATIONS) {
            tempDate.setUTCDate(tempDate.getUTCDate() + 1); // Advance one day
            if (!isWeekend(tempDate) && !isHoliday(tempDate)) {
                 // Only count if the date is on or before the due date
                 if (tempDate.getTime() <= dueDate.getTime()){
                    businessDaysRemaining++;
                 }
            }
             iterations++;
        }
         if (iterations >= MAX_FUTURE_ITERATIONS) {
            console.error("Max iterations reached calculating future remaining days.");
            return { days: Infinity, text: 'Error Calc.', isPast: false, isToday: false }; // Indicate error
        }

        return {
            days: businessDaysRemaining,
            text: `${businessDaysRemaining} día(s)`,
            isPast: false,
            isToday: false
        };
    }
}


/**
 * Recalcula la fecha de vencimiento para todos los términos almacenados.
 * Útil después de actualizar la lista de festivos.
 */
function recalculateAllDueDates() {
    console.log("Recalculating due dates for all stored terms...");
    let data = loadData();
    let updatedCount = 0;
    let errorCount = 0;

    // Ensure config (and thus holidays) is loaded before recalculating
    const config = getCurrentConfig();

    const updatedData = data.map(term => {
        // Check if term has necessary info
        if (term && typeof term.fechaInicio === 'string' && typeof term.dias === 'number') {
             const originalDueDate = term.fechaVencimiento;
             const newDueDate = calculateDueDate(term.fechaInicio, term.dias);

            if (newDueDate !== null) {
                if (newDueDate !== originalDueDate) {
                     console.log(`Recalculated due date for term ${term.id}: ${originalDueDate} -> ${newDueDate}`);
                     term.fechaVencimiento = newDueDate;
                     term.fechaRegistro = new Date().toISOString(); // Update modification timestamp
                     updatedCount++;
                }
                 return term; // Return term (updated or not)
            } else {
                 // Error during recalculation for this term
                 console.error(`Failed to recalculate due date for term ID ${term.id}. Keeping original: ${originalDueDate}`);
                 errorCount++;
                 return term; // Return original term on error
            }
        } else {
             console.warn(`Term ID ${term.id || '(no ID)'} lacks required fields for recalculation. Skipping.`);
             return term; // Skip invalid terms
        }
    });

    // Save the potentially modified data
    const saveSuccess = saveData(updatedData);

    if (saveSuccess) {
        console.log(`Recalculation complete. ${updatedCount} terms updated, ${errorCount} errors encountered.`);
        // showMessage(`Fechas recalculadas: ${updatedCount} actualizadas.`, 'info');
    } else {
         console.error("Failed to save data after recalculation.");
         // showMessage("Error al guardar los datos después de recalcular fechas.", "error");
    }
     return { updated: updatedCount, errors: errorCount };
}

// --- Utilidades ---

/**
 * Genera un ID único simple. Combina aleatoriedad con timestamp.
 * Formato: _[randomAlphanum][timestampBase36]
 * @returns {string} Un ID pseudo-único.
 */
function generateId() {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
    // after the decimal.
    const randomPart = Math.random().toString(36).substring(2, 11); // 9 chars
    const timePart = Date.now().toString(36); // Timestamp component
    const id = `_${randomPart}${timePart}`;
    // console.debug(`Generated ID: ${id}`); // Debugging
    return id;
}


// --- Exportación / Importación de Datos (CSV) ---

/**
 * Convierte un array de objetos TerminoProcesal a formato CSV.
 * @param {TerminoProcesal[]} data - El array de términos.
 * @returns {string} El string CSV generado.
 */
function convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return ""; // Return empty string if no data
    }

    // Define CSV headers based on TerminoProcesal keys
    const headers = [
        "id", "expediente", "juzgado", "tipoValue", "tipoText",
        "fechaInicio", "dias", "fechaVencimiento", "horaVencimiento",
        "notas", "fechaRegistro"
    ];
    const csvRows = [headers.join(",")]; // Header row

    // Function to safely escape CSV fields
    const escapeCSV = (field) => {
        if (field === null || typeof field === 'undefined') return '';
        let strField = String(field);
        // Escape double quotes by doubling them and enclose in double quotes if field contains comma, newline, or double quote
        if (strField.includes(',') || strField.includes('\n') || strField.includes('"')) {
            strField = `"${strField.replace(/"/g, '""')}"`;
        }
        return strField;
    };

    // Create data rows
    data.forEach(term => {
        const row = headers.map(header => escapeCSV(term[header]));
        csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
}

/**
 * Parsea un string CSV y lo convierte en un array de objetos TerminoProcesal.
 * Asume que la primera línea es la cabecera y coincide con las claves de TerminoProcesal.
 * @param {string} csvString - El string CSV a parsear.
 * @returns {TerminoProcesal[]} El array de términos parseados. Puede retornar array vacío si el CSV es inválido o vacío.
 * @throws {Error} Si el formato del CSV es incorrecto o las cabeceras no coinciden.
 */
function parseCSV(csvString) {
    if (typeof csvString !== 'string' || csvString.trim() === '') {
        console.warn("CSV string is empty or invalid.");
        return [];
    }

    const rows = csvString.split('\n');
    if (rows.length < 2) {
         throw new Error("CSV inválido: No contiene datos o cabeceras.");
    }

    // Basic CSV parsing (doesn't handle complex cases like quotes within quotes perfectly)
    const headers = rows[0].split(',').map(h => h.trim());
    const expectedHeaders = [
        "id", "expediente", "juzgado", "tipoValue", "tipoText",
        "fechaInicio", "dias", "fechaVencimiento", "horaVencimiento",
        "notas", "fechaRegistro"
    ];

    // Validate headers (simple check)
    if (headers.length !== expectedHeaders.length || !headers.every((h, i) => h === expectedHeaders[i])) {
         console.error("CSV Headers mismatch:", headers, "Expected:", expectedHeaders);
        throw new Error(`Cabeceras CSV inválidas. Se esperaba: ${expectedHeaders.join(', ')}`);
    }

    const data = [];
    for (let i = 1; i < rows.length; i++) {
        const rowString = rows[i].trim();
        if (!rowString) continue; // Skip empty lines

        // Very basic split, might fail with escaped commas within quotes
        // A more robust CSV parser library would be better for production
        const values = rowString.split(','); // Limitation: doesn't handle commas in fields correctly

        if (values.length !== headers.length) {
             console.warn(`Skipping row ${i + 1}: Incorrect number of columns. Found ${values.length}, expected ${headers.length}. Row: ${rowString}`);
            continue; // Skip rows with incorrect column count
        }

        const term = {};
        try {
            headers.forEach((header, index) => {
                 let value = values[index]?.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"'); // Basic unescape

                // Type conversion based on header
                if (header === 'dias') {
                    term[header] = parseInt(value, 10);
                    if (isNaN(term[header])) term[header] = 0; // Default or handle error
                } else if (header === 'horaVencimiento' && !value) {
                    term[header] = null;
                } else {
                    term[header] = value || ''; // Default to empty string if undefined/null
                }
            });

            // Additional validation for required fields like id, fechaInicio, etc.
            if (!term.id || !term.fechaInicio || typeof term.dias !== 'number') {
                 console.warn(`Skipping row ${i + 1}: Missing or invalid required fields (id, fechaInicio, dias). Term:`, term);
                continue;
            }
             // Validate date formats
            if (!/^\d{4}-\d{2}-\d{2}$/.test(term.fechaInicio) || (term.fechaVencimiento && !/^\d{4}-\d{2}-\d{2}$/.test(term.fechaVencimiento))) {
                 console.warn(`Skipping row ${i + 1}: Invalid date format. Term:`, term);
                continue;
            }

            data.push(term);
        } catch (parseError) {
             console.error(`Error parsing row ${i + 1}: ${parseError}. Row content: ${rowString}. Skipping.`);
             continue;
        }
    }

    console.log(`Successfully parsed ${data.length} terms from CSV.`);
    return data;
}

// --- Exportaciones del Módulo ---
// Exportar funciones y constantes que necesiten otros módulos
export const DataManager = {
    loadConfig,
    saveConfig,
    resetConfigToDefaults,
    getCurrentConfig,
    loadData,
    saveData,
    saveOrUpdateTerm,
    deleteTermById,
    deleteAllTerms,
    convertToCSV,
    parseCSV,
    recalculateAllDueDates,
    generateId,
    // Make calculation functions available if needed externally
    calculateDueDate,
    calculateDaysRemaining,
    isWeekend,
    isHoliday,
    // Constants
    DEFAULT_CONFIG,
    CONFIG_KEY,
    DATA_KEY
};

// Indicate Module 1 has loaded (for debugging)
console.log("Module 1 (Core Logic & Data) loaded.");
// --- End of module1.js --- Approx 750+ lines with comments & logic ---

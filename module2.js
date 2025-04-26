// =============================================================================
// LexTerminus v2.1 - Modulo 2: UI Management & Form Handling
// Autor: [Tu Nombre/AI]
// Fecha: 2025-04-26
// Descripción: Maneja la interacción con la interfaz de usuario,
// incluyendo la navegación por pestañas, mensajes, indicadores de carga,
// y toda la lógica relacionada con el formulario de registro/edición.
// =============================================================================

"use strict";

// Importar dependencias (Asegúrate que module1.js exporta DataManager)
import { DataManager } from './module1.js';
// Importaremos TableManager en Module 3, pero lo necesitaremos aquí para refrescar
// Por ahora, asumiremos que existe una forma de llamarlo (ej. a través de un objeto App global o eventos)
// Solución temporal: Añadiremos una referencia global placeholder o usaremos Custom Events más adelante si es necesario.
// O mejor aún, que handleSubmit devuelva algo para que el iniciador (en module3) refresque.
// De momento, comentaremos las llamadas a TableManager aquí y las manejaremos en module3.
// import { TableManager } from './module3.js'; // Descomentar y ajustar si es necesario

// --- Variables y Constantes del Módulo ---

const uiElements = {
    landingSection: document.getElementById('landing'),
    appSection: document.getElementById('app'),
    enterAppButton: document.getElementById('enterAppButton'),
    landingLoading: document.getElementById('landing-loading'),
    messageArea: document.getElementById('messageArea'),
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    referenceSearchInput: document.getElementById('searchReferencia'),
    referenceSections: document.querySelectorAll('.reference-section'),
    noReferenceFound: document.getElementById('noReferenceFound'),
};

const formElements = {
    form: document.getElementById('registroForm'),
    formLoading: document.getElementById('form-loading'),
    editTerminoId: document.getElementById('editTerminoId'),
    formTitle: document.getElementById('registroFormTitle'),
    submitButton: document.getElementById('submitButton'),
    expediente: document.getElementById('expediente'),
    juzgado: document.getElementById('juzgado'),
    tipoTermino: document.getElementById('tipoTermino'),
    otroTipoTerminoLabel: document.querySelector('label[for="otroTipoTermino"]'),
    otroTipoTermino: document.getElementById('otroTipoTermino'),
    fechaInicio: document.getElementById('fechaInicio'),
    dias: document.getElementById('dias'),
    fechaVencimiento: document.getElementById('fechaVencimiento'),
    horaVencimiento: document.getElementById('horaVencimiento'),
    notas: document.getElementById('notas'),
    notasCharCount: document.getElementById('notasCharCount'),
    // Error placeholders
    expedienteError: document.getElementById('expedienteError'),
    juzgadoError: document.getElementById('juzgadoError'), // Added based on HTML
    tipoTerminoError: document.getElementById('tipoTerminoError'),
    otroTipoTerminoError: document.getElementById('otroTipoTerminoError'),
    fechaInicioError: document.getElementById('fechaInicioError'),
    diasError: document.getElementById('diasError'),
    fechaVencimientoError: document.getElementById('fechaVencimientoError'), // Added based on HTML
};

let messageTimeout = null; // Timer para ocultar mensajes

// --- UIManager ---

const UIManager = {
    /** Inicializa los listeners del UI Manager */
    initUIManager() {
        console.log("Initializing UIManager...");
        if (uiElements.enterAppButton) {
            uiElements.enterAppButton.addEventListener('click', this.showApp);
        } else {
            console.error("#enterAppButton not found.");
            // Si el botón no existe, quizás ya estamos en la app (ej. deep link o refresh)
            // Ocultar landing y mostrar app si los datos ya están cargados
             if(localStorage.getItem(DataManager.DATA_KEY)){ // Simple check
                 this.showApp();
             }
        }

        uiElements.tabs.forEach(tab => {
            tab.addEventListener('click', (event) => this.openTab(event, tab.getAttribute('aria-controls')));
        });

        if (uiElements.referenceSearchInput) {
            uiElements.referenceSearchInput.addEventListener('input', (event) => this.searchReferences(event.target.value));
        }

        // Add listeners for reference section toggles (handled in HTML via onclick, but could be done here)
        // document.querySelectorAll('.reference-button').forEach(button => {
        //     button.addEventListener('click', () => this.toggleReferenceSection(button));
        // });

        // Ensure initial state hides app if landing exists
        if(uiElements.landingSection && uiElements.appSection){
             if (uiElements.landingSection.style.display !== 'none') {
                 uiElements.appSection.style.display = 'none';
             } else {
                 // If landing is already hidden, ensure app is shown
                  uiElements.appSection.style.display = 'block'; // Or appropriate display value
             }
        } else {
             console.warn("Landing or App section not found for initial display logic.");
        }

        console.log("UIManager initialized.");
    },

    /** Muestra la aplicación principal y oculta la landing page */
    showApp() {
        console.log("Entering app...");
        if (uiElements.landingSection) uiElements.landingSection.style.display = 'none';
        if (uiElements.appSection) uiElements.appSection.style.display = 'block'; // Or appropriate display like 'grid'/'flex' based on CSS

        // Optional: Cargar datos iniciales aquí o dejar que TableManager lo haga en su init
        // console.log("Triggering initial table load (placeholder)...");
        // TableManager.refreshConsultaTable(); // Needs TableManager reference
        // TableManager.refreshVencimientosTable(); // Needs TableManager reference
        // Trigger a custom event that module3 can listen for?
         document.dispatchEvent(new CustomEvent('appEntered'));
         console.log("Dispatched 'appEntered' event.");
    },

    /**
     * Muestra un mensaje al usuario.
     * @param {string} message - El texto del mensaje.
     * @param {'info'|'success'|'error'} [type='info'] - El tipo de mensaje.
     * @param {number} [duration=5000] - Duración en ms antes de ocultar (0 para no ocultar).
     */
    showMessage(message, type = 'info', duration = 5000) {
        if (!uiElements.messageArea) return;

        clearTimeout(messageTimeout); // Clear previous timeout if any
        uiElements.messageArea.textContent = message;
        uiElements.messageArea.className = `message ${type}`; // Reset classes and add type
        uiElements.messageArea.style.display = 'block';
        uiElements.messageArea.setAttribute('role', type === 'error' ? 'alert' : 'status'); // Set ARIA role

        if (duration > 0) {
            messageTimeout = setTimeout(() => {
                this.clearMessage();
            }, duration);
        }
    },

    /** Oculta el área de mensajes */
    clearMessage() {
        if (!uiElements.messageArea) return;
        uiElements.messageArea.style.display = 'none';
        uiElements.messageArea.textContent = '';
        uiElements.messageArea.className = 'message';
        uiElements.messageArea.removeAttribute('role');
         clearTimeout(messageTimeout);
    },

    /**
     * Cambia a la pestaña especificada.
     * @param {Event} event - El evento del clic (opcional, para prevenir default si es necesario).
     * @param {string} tabName - El ID de la sección de contenido a mostrar (ej: 'registro').
     */
    openTab(event, tabName) {
         // Prevent default if it's an event handler triggered by HTML onclick
        if (event && event.preventDefault) {
           // event.preventDefault(); // Not strictly needed for buttons unless they are inside a form causing submit
        }
        console.log(`Switching to tab: ${tabName}`);

        // Hide all tab contents
        uiElements.tabContents.forEach(content => content.classList.remove('active'));

        // Deactivate all tabs
        uiElements.tabs.forEach(tab => {
             tab.classList.remove('active');
             tab.setAttribute('aria-selected', 'false');
         });

        // Activate the selected tab and content
        const contentToShow = document.getElementById(tabName);
        const tabButton = document.getElementById(`tab-${tabName}`);

        if (contentToShow) {
            contentToShow.classList.add('active');
        } else {
             console.error(`Tab content with id '${tabName}' not found.`);
        }

        if (tabButton) {
            tabButton.classList.add('active');
             tabButton.setAttribute('aria-selected', 'true');
        } else {
             console.error(`Tab button with id 'tab-${tabName}' not found.`);
        }

         // Clear messages when switching tabs? Optional.
         // this.clearMessage();
    },

    /**
     * Muestra un indicador de carga.
     * @param {string} elementId - El ID del elemento indicador de carga.
     */
    showLoading(elementId) {
        const indicator = document.getElementById(elementId);
        if (indicator) {
            indicator.style.display = 'inline-block'; // O 'block' según el CSS
        }
    },

    /**
     * Oculta un indicador de carga.
     * @param {string} elementId - El ID del elemento indicador de carga.
     */
    hideLoading(elementId) {
        const indicator = document.getElementById(elementId);
        if (indicator) {
            indicator.style.display = 'none';
        }
    },

    /**
     * Expande o colapsa una sección de referencia. (Llamada desde HTML onclick)
     * @param {HTMLButtonElement} button - El botón que fue clickeado.
     */
    toggleReferenceSection(button) {
         if (!button) return;
        const content = button.nextElementSibling; // Assumes content is immediately after button
        if (!content || !content.classList.contains('reference-content')) {
             console.error("Could not find reference content for button:", button);
             return;
         }

        const isExpanded = content.style.display === 'block';
        content.style.display = isExpanded ? 'none' : 'block';
        button.textContent = isExpanded ? button.textContent.replace('(-)', '(+)') : button.textContent.replace('(+)', '(-)');
         button.setAttribute('aria-expanded', !isExpanded);
    },

    /**
     * Filtra las secciones de referencia basadas en el término de búsqueda.
     * @param {string} searchTerm - El texto a buscar.
     */
    searchReferences(searchTerm) {
        if (!uiElements.referenceSearchInput) return; // Guard clause

        const lowerSearchTerm = searchTerm.toLowerCase().trim();
        let found = false;

        uiElements.referenceSections.forEach(section => {
            const keywords = section.dataset.keywords || '';
            const sectionText = section.textContent.toLowerCase(); // Search in text content too
            const isMatch = lowerSearchTerm === '' || keywords.toLowerCase().includes(lowerSearchTerm) || sectionText.includes(lowerSearchTerm);

            section.style.display = isMatch ? 'block' : 'none';
            if (isMatch) {
                found = true;
            }
        });

        if (uiElements.noReferenceFound) {
            uiElements.noReferenceFound.style.display = found ? 'none' : 'block';
        }
    },

    /**
     * Actualiza el contador de caracteres para el textarea de notas.
     */
    updateCharCount() {
         if (!formElements.notas || !formElements.notasCharCount) return;
        const currentLength = formElements.notas.value.length;
        const maxLength = formElements.notas.getAttribute('maxlength') || 1000;
        formElements.notasCharCount.textContent = `${currentLength}`; // Just show current count
        // Optional: Add visual feedback if nearing/exceeding limit
        if (currentLength > maxLength) {
             formElements.notasCharCount.style.color = 'red'; // Example
        } else {
             formElements.notasCharCount.style.color = ''; // Reset color
        }
    }
};

// --- FormManager ---

const FormManager = {
    /** Inicializa los listeners y el estado inicial del formulario */
    initForm() {
        console.log("Initializing FormManager...");
        if (!formElements.form) {
            console.error("#registroForm not found. FormManager cannot initialize.");
            return;
        }

        formElements.form.addEventListener('submit', this.handleSubmit.bind(this));

        const clearButton = formElements.form.querySelector('button[type="button"].secondary');
        if (clearButton && clearButton.textContent.includes('Limpiar')) {
             clearButton.addEventListener('click', this.clearForm.bind(this));
        }

        // Listeners for dynamic updates
        if (formElements.tipoTermino) formElements.tipoTermino.addEventListener('change', this.handleTipoTerminoChange.bind(this));
        if (formElements.fechaInicio) formElements.fechaInicio.addEventListener('input', this.updateDueDateCalculation.bind(this));
        if (formElements.dias) formElements.dias.addEventListener('input', this.updateDueDateCalculation.bind(this));
        if (formElements.notas) formElements.notas.addEventListener('input', UIManager.updateCharCount); // Use UIManager directly

        this.clearForm(); // Set initial state
        console.log("FormManager initialized.");
    },

    /** Maneja el cambio en el select de Tipo de Término */
    handleTipoTerminoChange() {
        if (!formElements.tipoTermino || !formElements.dias) return;

        const selectedOption = formElements.tipoTermino.options[formElements.tipoTermino.selectedIndex];
        const days = selectedOption.dataset.days;
        const value = selectedOption.value;

        // Update 'dias' field if data-days exists and is a number
        if (days !== undefined && days !== "" && !isNaN(Number(days))) {
            formElements.dias.value = Number(days);
             formElements.dias.readOnly = true; // Make it readonly if predefined
        } else {
             formElements.dias.value = ''; // Clear if no predefined days (like 'Otro' or manual ones)
             formElements.dias.readOnly = false;
        }

        // Show/hide 'Otro Tipo' field
        const showOtro = value === 'otro';
        if(formElements.otroTipoTerminoLabel) formElements.otroTipoTerminoLabel.style.display = showOtro ? 'block' : 'none';
        if(formElements.otroTipoTermino) {
             formElements.otroTipoTermino.style.display = showOtro ? 'block' : 'none';
             formElements.otroTipoTermino.required = showOtro;
             if (!showOtro) {
                 formElements.otroTipoTermino.value = ''; // Clear if hidden
                 this.clearError('otroTipoTermino');
             }
        }


        this.updateDueDateCalculation(); // Recalculate due date
         this.clearError('tipoTermino'); // Clear error on change
         this.clearError('dias'); // Clear error on change
    },

    /** Actualiza el campo de Fecha de Vencimiento basado en Fecha Inicio y Días */
    updateDueDateCalculation() {
         if (!formElements.fechaInicio || !formElements.dias || !formElements.fechaVencimiento) return;

        const fechaInicio = formElements.fechaInicio.value;
        const dias = parseInt(formElements.dias.value, 10);

        // Clear previous error
        this.clearError('fechaVencimiento');

        if (fechaInicio && typeof dias === 'number' && dias >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
            // Use DataManager's function
            try {
                const dueDate = DataManager.calculateDueDate(fechaInicio, dias);
                if (dueDate) {
                    formElements.fechaVencimiento.value = dueDate;
                     this.clearError('fechaInicio'); // Clear related errors if calculation works
                     this.clearError('dias');
                } else {
                    formElements.fechaVencimiento.value = '';
                    // Optionally show an error if calculation returns null but inputs seemed valid
                    // console.warn("Due date calculation returned null.");
                    this.showError('fechaVencimiento', 'No se pudo calcular la fecha.');
                }
            } catch (error) {
                 console.error("Error during due date calculation:", error);
                 formElements.fechaVencimiento.value = '';
                 this.showError('fechaVencimiento', 'Error al calcular.');
            }
        } else {
            // Clear due date if inputs are invalid or incomplete
            formElements.fechaVencimiento.value = '';
            // Don't show error here, validation handles missing inputs
        }
    },

    /**
     * Valida el formulario de registro/edición.
     * @returns {boolean} `true` si el formulario es válido, `false` en caso contrario.
     */
    validateForm() {
        let isValid = true;
        this.clearAllErrors(); // Clear previous errors

        // Expediente (Required, non-empty)
        if (!formElements.expediente.value.trim()) {
            this.showError('expediente', 'El número de expediente es obligatorio.');
            isValid = false;
        }

         // Juzgado (Optional, but check if validation exists - e.g. max length)
        // No specific validation rule in HTML apart from placeholder.

        // Tipo de Término (Required)
        if (!formElements.tipoTermino.value) {
            this.showError('tipoTermino', 'Seleccione un tipo de término.');
            isValid = false;
        }

        // Otro Tipo de Término (Required if tipoTermino is 'otro')
        if (formElements.tipoTermino.value === 'otro' && !formElements.otroTipoTermino.value.trim()) {
            this.showError('otroTipoTermino', 'Especifique el tipo de término.');
            isValid = false;
        }

        // Fecha de Inicio (Required, valid date format implicitly checked by input type="date")
        if (!formElements.fechaInicio.value) {
            this.showError('fechaInicio', 'La fecha de inicio es obligatoria.');
            isValid = false;
        }
        // Simple date logic check (prevent future start dates? maybe not needed)

        // Días (Required, non-negative integer)
        const diasValue = formElements.dias.value;
        if (diasValue === '' || diasValue === null || isNaN(parseInt(diasValue, 10)) || parseInt(diasValue, 10) < 0) {
            this.showError('dias', 'Ingrese un número válido de días (0 o más).');
            isValid = false;
        }

        // Fecha Vencimiento (Should be calculated, check if calculation failed?)
         if (diasValue !== '' && parseInt(diasValue, 10) >= 0 && formElements.fechaInicio.value && !formElements.fechaVencimiento.value) {
             this.showError('fechaVencimiento', 'Error al calcular vencimiento. Verifique festivos y fecha inicio.');
             // isValid = false; // Or just a warning? Let's allow submit but warn user maybe.
         }

        // Hora Vencimiento (Optional, format check?)
         if (formElements.horaVencimiento.value && !/^\d{2}:\d{2}$/.test(formElements.horaVencimiento.value)) {
             // Note: input type="time" usually handles format, but good practice
             this.showError('horaVencimiento', 'Formato de hora inválido (HH:mm).'); // Need a horaVencimientoError element in HTML
             isValid = false;
         }

        // Notas (Check length)
        if (formElements.notas.value.length > (formElements.notas.getAttribute('maxlength') || 1000)) {
            this.showError('notas', 'Las notas exceden el límite de caracteres.'); // Need a notasError element in HTML
             isValid = false;
        }


        return isValid;
    },

    /** Maneja el envío del formulario */
    async handleSubmit(event) {
        event.preventDefault();
        console.log("Handling form submit...");

        if (!this.validateForm()) {
            UIManager.showMessage("Por favor corrija los errores en el formulario.", "error", 3000);
            console.log("Form validation failed.");
            // Ensure first invalid field is focused for accessibility
             const firstError = formElements.form.querySelector('.validation-error:not(:empty)');
             if(firstError && firstError.id){
                 const inputId = firstError.id.replace('Error', '');
                 const inputElement = document.getElementById(inputId);
                 inputElement?.focus();
             }
            return;
        }

        UIManager.showLoading(formElements.formLoading.id);
        UIManager.clearMessage(); // Clear previous messages

        const isEditing = !!formElements.editTerminoId.value;
        const termId = isEditing ? formElements.editTerminoId.value : DataManager.generateId();
        const selectedOption = formElements.tipoTermino.options[formElements.tipoTermino.selectedIndex];

        /** @type {TerminoProcesal} */
        const terminoData = {
            id: termId,
            expediente: formElements.expediente.value.trim(),
            juzgado: formElements.juzgado.value.trim(),
            tipoValue: formElements.tipoTermino.value,
            // Get text, handling 'Otro' case
            tipoText: formElements.tipoTermino.value === 'otro'
                ? `Otro: ${formElements.otroTipoTermino.value.trim()}`
                : selectedOption.text,
            fechaInicio: formElements.fechaInicio.value,
            dias: parseInt(formElements.dias.value, 10),
            fechaVencimiento: formElements.fechaVencimiento.value, // Already calculated
            horaVencimiento: formElements.horaVencimiento.value || null, // Store null if empty
            notas: formElements.notas.value.trim(),
            fechaRegistro: new Date().toISOString() // Overwritten by saveOrUpdateTerm, but good to have
        };

        console.log(isEditing ? "Updating Term:" : "Adding New Term:", terminoData);

        // Simulate async operation (optional, remove if DataManager is synchronous)
        // await new Promise(resolve => setTimeout(resolve, 300));

        try {
            const success = DataManager.saveOrUpdateTerm(terminoData);

            if (success) {
                UIManager.showMessage(`Término ${isEditing ? 'actualizado' : 'registrado'} correctamente.`, 'success');
                this.clearForm();
                // Trigger table refresh (will be handled by the initiator in module3)
                 document.dispatchEvent(new CustomEvent('termSaved', { detail: { term: terminoData } }));
                 console.log("Dispatched 'termSaved' event.");
                // Optional: Switch back to Consulta tab after successful save/update?
                // UIManager.openTab(null, 'consulta');
            } else {
                UIManager.showMessage(`Error al ${isEditing ? 'actualizar' : 'guardar'} el término. Revise la consola.`, 'error');
            }
        } catch (error) {
             console.error(`Error during save/update term:`, error);
             UIManager.showMessage(`Error inesperado al ${isEditing ? 'actualizar' : 'guardar'}.`, 'error');
        } finally {
             UIManager.hideLoading(formElements.formLoading.id);
        }
    },

    /** Limpia el formulario a su estado inicial */
    clearForm() {
        console.log("Clearing form.");
        if (formElements.form) formElements.form.reset(); // Resets most fields

        // Reset specific fields and states
        formElements.editTerminoId.value = '';
        formElements.formTitle.textContent = 'Registro de Nuevo Término Procesal';
        formElements.submitButton.textContent = 'Registrar Término';
         formElements.fechaVencimiento.value = ''; // Clear calculated field
         formElements.dias.readOnly = false; // Ensure dias is editable

        // Hide 'Otro' field initially
         if(formElements.otroTipoTerminoLabel) formElements.otroTipoTerminoLabel.style.display = 'none';
         if(formElements.otroTipoTermino) {
            formElements.otroTipoTermino.style.display = 'none';
            formElements.otroTipoTermino.required = false;
         }


        // Reset character count
        UIManager.updateCharCount();

        // Clear all validation errors
        this.clearAllErrors();

         // Optionally focus the first field
         // formElements.expediente?.focus();
    },

    /**
     * Rellena el formulario con datos de un término para edición.
     * @param {string} termId - El ID del término a editar.
     */
    populateFormForEdit(termId) {
        console.log(`Populating form for editing term ID: ${termId}`);
        this.clearForm(); // Start with a clean form

        const terms = DataManager.loadData();
        const term = terms.find(t => t.id === termId);

        if (!term) {
            UIManager.showMessage("Error: No se encontró el término para editar.", "error");
            console.error(`Term with ID ${termId} not found in loaded data.`);
            return;
        }

        formElements.editTerminoId.value = term.id;
        formElements.expediente.value = term.expediente || '';
        formElements.juzgado.value = term.juzgado || '';
        formElements.tipoTermino.value = term.tipoValue || '';

        // Handle 'Otro' case
        if (term.tipoValue === 'otro') {
             if(formElements.otroTipoTerminoLabel) formElements.otroTipoTerminoLabel.style.display = 'block';
             if(formElements.otroTipoTermino) {
                 formElements.otroTipoTermino.style.display = 'block';
                 formElements.otroTipoTermino.required = true;
                 // Extract the custom text after "Otro: "
                 formElements.otroTipoTermino.value = term.tipoText.replace(/^Otro:\s*/, '');
             }
        } else {
            if(formElements.otroTipoTerminoLabel) formElements.otroTipoTerminoLabel.style.display = 'none';
            if(formElements.otroTipoTermino) {
                 formElements.otroTipoTermino.style.display = 'none';
                 formElements.otroTipoTermino.required = false;
                 formElements.otroTipoTermino.value = '';
            }
        }


        formElements.fechaInicio.value = term.fechaInicio || '';
        formElements.dias.value = term.dias !== undefined ? term.dias : '';
        formElements.fechaVencimiento.value = term.fechaVencimiento || ''; // Should already be calculated
        formElements.horaVencimiento.value = term.horaVencimiento || '';
        formElements.notas.value = term.notas || '';

        // Update state for 'dias' readonly if applicable
         const selectedOption = formElements.tipoTermino.options[formElements.tipoTermino.selectedIndex];
        if (selectedOption && selectedOption.dataset.days !== undefined && selectedOption.dataset.days !== "") {
             formElements.dias.readOnly = true;
        } else {
             formElements.dias.readOnly = false;
        }


        formElements.formTitle.textContent = 'Editar Término Procesal';
        formElements.submitButton.textContent = 'Actualizar Término';

        UIManager.updateCharCount(); // Update counter for loaded notes

        // Switch to the Registro tab
        UIManager.openTab(null, 'registro');
         formElements.expediente?.focus(); // Focus first field
    },

    /** Muestra un mensaje de error para un campo específico */
    showError(inputId, message) {
        const errorElement = formElements[`${inputId}Error`]; // Assumes element ID convention like 'expedienteError'
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block'; // Or 'inline' based on CSS
            // Add ARIA described-by to the input if not already present? More complex.
             const inputElement = formElements[inputId];
             inputElement?.setAttribute('aria-invalid', 'true');
             inputElement?.setAttribute('aria-describedby', errorElement.id);
        } else {
            console.warn(`Error element for inputId '${inputId}' not found.`);
        }
    },

    /** Limpia el mensaje de error para un campo específico */
    clearError(inputId) {
        const errorElement = formElements[`${inputId}Error`];
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
             const inputElement = formElements[inputId];
             inputElement?.removeAttribute('aria-invalid');
             inputElement?.removeAttribute('aria-describedby');
        }
    },

    /** Limpia todos los mensajes de error del formulario */
    clearAllErrors() {
        Object.keys(formElements).forEach(key => {
            if (key.endsWith('Error')) {
                if(formElements[key]){
                     formElements[key].textContent = '';
                     formElements[key].style.display = 'none';
                }
            }
             // Clear ARIA attributes from inputs
             if (formElements[key] && formElements[key].tagName && (formElements[key].tagName === 'INPUT' || formElements[key].tagName === 'SELECT' || formElements[key].tagName === 'TEXTAREA')) {
                 formElements[key].removeAttribute('aria-invalid');
                 formElements[key].removeAttribute('aria-describedby');
             }
        });
    }
};

// --- Exportaciones del Módulo ---
export { UIManager, FormManager };

// --- Inicialización del Módulo ---
// La inicialización principal (DOMContentLoaded) se hará en module3.js
// Pero podemos llamar a inits específicos si son seguros de ejecutar ahora.
// UIManager.initUIManager(); // Safe to run now as it only adds listeners
// FormManager.initForm(); // Safe to run now

// Indicate Module 2 has loaded
console.log("Module 2 (UI & Form) loaded.");
// --- End of module2.js --- Approx 450+ lines ---

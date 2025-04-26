// =============================================================================
// LexTerminus v2.1 - Modulo 3: Table Management, Configuration & App Init
// Autor: [Tu Nombre/AI]
// Fecha: 2025-04-26
// Descripción: Maneja la visualización y lógica de las tablas de consulta
// y vencimientos (incluyendo paginación, ordenamiento, filtros, búsqueda
// y acciones). Gestiona la pestaña de configuración y las operaciones de
// importación/exportación de datos. Inicializa la aplicación completa.
// =============================================================================

"use strict";

// Importar dependencias
import { DataManager } from './module1.js';
import { UIManager, FormManager } from './module2.js';

// --- Variables y Constantes del Módulo ---

const tableElements = {
    // Consulta Table
    searchConsulta: document.getElementById('searchConsulta'),
    sortConsulta: document.getElementById('sortConsulta'),
    refreshConsultaButton: document.querySelector('#consulta .table-controls button'), // More specific selector needed if ambiguous
    consultaTableBody: document.getElementById('consultaTableBody'),
    consultaPagination: document.getElementById('consultaPagination'),
    // Vencimientos Table
    filterVencimientos: document.getElementById('filterVencimientos'),
    refreshVencimientosButton: document.querySelector('#vencimientos .table-controls button'),
    vencimientosTableBody: document.getElementById('vencimientosTableBody'),
    vencimientosPagination: document.getElementById('vencimientosPagination'),
};

const configElements = {
    configForm: document.getElementById('configForm'),
    holidays: document.getElementById('holidays'),
    warningDays: document.getElementById('warningDays'),
    urgentDays: document.getElementById('urgentDays'),
    itemsPerPage: document.getElementById('itemsPerPage'),
    resetDefaultsButton: document.querySelector('#configForm button[type="button"].secondary'),
    configLoading: document.getElementById('config-loading'),
    // Data Management
    exportButton: document.querySelector('.data-management button.secondary'), // Adjust selector if needed
    importFile: document.getElementById('importFile'),
    importButton: document.querySelector('.data-management button[onclick="DataManager.importData()"]'), // Or get by specific ID/class
    importLoading: document.getElementById('import-loading'),
    clearAllButton: document.querySelector('.data-management button.danger'),
    holidaysError: document.getElementById('holidaysError'), // For validation
};

// --- TableManager State ---
const tableState = {
    consulta: {
        currentPage: 1,
        sortCriteria: 'fechaRegistroDesc', // Default sort
        searchQuery: '',
    },
    vencimientos: {
        currentPage: 1,
        filter: 'pending', // Default filter: 'pending' o 'all'? Let's start with 'pending'
        // Vencimientos table implicitly sorted by due date ascending
    }
};

// --- TableManager ---

const TableManager = {

    /** Inicializa los listeners de las tablas y realiza la carga inicial */
    initTables() {
        console.log("Initializing TableManager...");
        if (!tableElements.consultaTableBody || !tableElements.vencimientosTableBody) {
            console.error("Table bodies not found. TableManager cannot initialize.");
            return;
        }

        // Add Listeners for Consulta Table
        if (tableElements.searchConsulta) tableElements.searchConsulta.addEventListener('input', this.handleSearch.bind(this));
        if (tableElements.sortConsulta) tableElements.sortConsulta.addEventListener('change', this.handleSortChange.bind(this));
        if (tableElements.refreshConsultaButton) tableElements.refreshConsultaButton.addEventListener('click', this.refreshConsultaTable.bind(this));

        // Add Listeners for Vencimientos Table
        if (tableElements.filterVencimientos) tableElements.filterVencimientos.addEventListener('change', this.handleFilterChange.bind(this));
        if (tableElements.refreshVencimientosButton) tableElements.refreshVencimientosButton.addEventListener('click', this.refreshVencimientosTable.bind(this));

        // Add listeners for dynamically generated elements (pagination, actions) - using event delegation
        if (tableElements.consultaPagination) tableElements.consultaPagination.addEventListener('click', (e) => this.handlePaginationClick(e, 'consulta'));
        if (tableElements.vencimientosPagination) tableElements.vencimientosPagination.addEventListener('click', (e) => this.handlePaginationClick(e, 'vencimientos'));
        if (tableElements.consultaTableBody) tableElements.consultaTableBody.addEventListener('click', this.handleActionClick.bind(this));

         // Set initial state from controls if needed (e.g., filter dropdown)
         if(tableElements.filterVencimientos){
             tableState.vencimientos.filter = tableElements.filterVencimientos.value;
         }
          if(tableElements.sortConsulta){
             tableState.consulta.sortCriteria = tableElements.sortConsulta.value;
         }


        // Initial data load is triggered by 'appEntered' event listener in main init below
        console.log("TableManager initialized.");
    },

    /** Refresca y renderiza la tabla de Consulta */
    refreshConsultaTable() {
        console.log("Refreshing Consulta Table...");
        const config = DataManager.getCurrentConfig(); // Needed for itemsPerPage
        const allData = DataManager.loadData();
        const { dataToShow, totalItems } = this.applyTableLogic(allData, 'consulta', config.itemsPerPage);

        this.renderTable(tableElements.consultaTableBody, dataToShow, 'consulta');
        this.renderPaginationControls(
            tableElements.consultaPagination,
            totalItems,
            config.itemsPerPage,
            tableState.consulta.currentPage,
            (newPage) => { // Callback function
                tableState.consulta.currentPage = newPage;
                this.refreshConsultaTable();
            }
        );
    },

    /** Refresca y renderiza la tabla de Vencimientos */
    refreshVencimientosTable() {
        console.log("Refreshing Vencimientos Table...");
        const config = DataManager.getCurrentConfig(); // Needed for itemsPerPage & alert days
        const allData = DataManager.loadData();
        const { dataToShow, totalItems } = this.applyTableLogic(allData, 'vencimientos', config.itemsPerPage);

        this.renderTable(tableElements.vencimientosTableBody, dataToShow, 'vencimientos');
        this.renderPaginationControls(
            tableElements.vencimientosPagination,
            totalItems,
            config.itemsPerPage,
            tableState.vencimientos.currentPage,
            (newPage) => { // Callback function
                tableState.vencimientos.currentPage = newPage;
                this.refreshVencimientosTable();
            }
        );
    },

    /**
     * Aplica lógica de filtrado, búsqueda, ordenamiento y paginación.
     * @param {TerminoProcesal[]} data - Datos crudos.
     * @param {'consulta'|'vencimientos'} tableType - Tipo de tabla.
     * @param {number} itemsPerPage - Ítems por página.
     * @returns {{dataToShow: TerminoProcesal[], totalItems: number}} - Datos filtrados para la página actual y total de ítems filtrados.
     */
    applyTableLogic(data, tableType, itemsPerPage) {
        let filteredData = [...data]; // Start with a copy

        // --- Filtering & Searching ---
        if (tableType === 'consulta') {
            const query = tableState.consulta.searchQuery.toLowerCase();
            if (query) {
                filteredData = filteredData.filter(term =>
                    (term.expediente?.toLowerCase() || '').includes(query) ||
                    (term.juzgado?.toLowerCase() || '').includes(query) ||
                    (term.tipoText?.toLowerCase() || '').includes(query) ||
                    (term.notas?.toLowerCase() || '').includes(query)
                );
            }
        } else { // Vencimientos
            const filter = tableState.vencimientos.filter;
            const today = new Date(); today.setUTCHours(0,0,0,0);
            const config = DataManager.getCurrentConfig();

            filteredData = filteredData.filter(term => {
                 if (!term.fechaVencimiento) return false; // Skip terms without due date
                 const remaining = DataManager.calculateDaysRemaining(term.fechaVencimiento);
                 if (!remaining) return false; // Skip if calculation fails

                switch (filter) {
                    case 'pending': // All future and today
                        return !remaining.isPast;
                    case 'urgent': // Urgent threshold and past due
                        return remaining.days <= config.urgentDays;
                    case 'warning': // Warning threshold up to (but not including) urgent threshold
                         return remaining.days <= config.warningDays && remaining.days > config.urgentDays && !remaining.isPast;
                    case 'past': // Only past due
                        return remaining.isPast;
                    case 'all': // Show everything with a due date
                         return true; // No filter applied here, just pass through
                    default:
                        return true;
                }
            });
        }

        // --- Sorting ---
        if (tableType === 'consulta') {
            const criteria = tableState.consulta.sortCriteria;
            filteredData.sort((a, b) => {
                switch (criteria) {
                    case 'fechaRegistroAsc': return new Date(a.fechaRegistro) - new Date(b.fechaRegistro);
                    case 'fechaRegistroDesc': return new Date(b.fechaRegistro) - new Date(a.fechaRegistro);
                    case 'fechaVencimientoAsc': return new Date(a.fechaVencimiento + 'T00:00:00Z') - new Date(b.fechaVencimiento + 'T00:00:00Z');
                    case 'fechaVencimientoDesc': return new Date(b.fechaVencimiento + 'T00:00:00Z') - new Date(a.fechaVencimiento + 'T00:00:00Z');
                    case 'expedienteAsc': return (a.expediente || '').localeCompare(b.expediente || '');
                    case 'expedienteDesc': return (b.expediente || '').localeCompare(a.expediente || '');
                    default: return 0;
                }
            });
        } else { // Vencimientos - Default sort by due date ascending
             filteredData.sort((a, b) => new Date(a.fechaVencimiento + 'T00:00:00Z') - new Date(b.fechaVencimiento + 'T00:00:00Z'));
        }

        // --- Pagination ---
        const totalItems = filteredData.length;
        const currentPage = tableType === 'consulta' ? tableState.consulta.currentPage : tableState.vencimientos.currentPage;
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const dataToShow = filteredData.slice(startIndex, endIndex);

        return { dataToShow, totalItems };
    },

    /**
     * Renderiza las filas de la tabla.
     * @param {HTMLTableSectionElement} tableBodyElement - El elemento tbody.
     * @param {TerminoProcesal[]} dataToShow - Datos a mostrar en esta página.
     * @param {'consulta'|'vencimientos'} tableType - Tipo de tabla.
     */
    renderTable(tableBodyElement, dataToShow, tableType) {
        tableBodyElement.innerHTML = ''; // Clear previous rows

        if (dataToShow.length === 0) {
            const colspan = tableType === 'consulta' ? 9 : 8;
            tableBodyElement.innerHTML = `<tr><td colspan="${colspan}" class="placeholder">No hay términos para mostrar con los filtros actuales.</td></tr>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        dataToShow.forEach(term => {
            const tr = document.createElement('tr');
             // Add status class for vencimientos table
             let statusClass = '';
             let remainingText = '';
             let statusText = 'Normal'; // Default status text
             let daysRemainingNumber = null;

             if (tableType === 'vencimientos') {
                 const remaining = DataManager.calculateDaysRemaining(term.fechaVencimiento);
                 if(remaining){
                     statusClass = this.getRowStatusClass(remaining);
                     remainingText = remaining.text;
                     daysRemainingNumber = remaining.days; // Store the number too
                     if (remaining.isPast) statusText = 'Vencido';
                     else if (statusClass === 'urgent-bg') statusText = 'Urgente';
                     else if (statusClass === 'warning-bg') statusText = 'Advertencia';
                 } else {
                     remainingText = 'Error Calc.';
                     statusText = 'Error';
                 }
                 tr.className = statusClass; // Apply class to the row
             }

            // Create cells based on table type
            if (tableType === 'consulta') {
                tr.innerHTML = `
                    <td data-label="Expediente">${term.expediente || '-'}</td>
                    <td data-label="Juzgado">${term.juzgado || '-'}</td>
                    <td data-label="Tipo Término" title="${term.tipoText || ''}">${this.truncateText(term.tipoText || '-', 30)}</td>
                    <td data-label="Fecha Inicio">${term.fechaInicio || '-'}</td>
                    <td data-label="Días">${term.dias !== undefined ? term.dias : '-'}</td>
                    <td data-label="Fecha Vencimiento">${term.fechaVencimiento || '-'}</td>
                    <td data-label="Hora Límite">${term.horaVencimiento || '-'}</td>
                    <td data-label="Notas" title="${term.notas || ''}">${this.truncateText(term.notas || '-', 50)}</td>
                    <td data-label="Acciones">
                        <button class="action-btn edit" data-id="${term.id}" title="Editar Término">✏️</button>
                        <button class="action-btn delete" data-id="${term.id}" title="Eliminar Término">🗑️</button>
                    </td>
                `;
            } else { // Vencimientos
                 tr.innerHTML = `
                    <td data-label="Expediente">${term.expediente || '-'}</td>
                    <td data-label="Tipo Término" title="${term.tipoText || ''}">${this.truncateText(term.tipoText || '-', 30)}</td>
                    <td data-label="Fecha Inicio">${term.fechaInicio || '-'}</td>
                    <td data-label="Fecha Vencimiento">${term.fechaVencimiento || '-'}</td>
                    <td data-label="Hora Límite">${term.horaVencimiento || '-'}</td>
                    <td data-label="Estado" class="status-${statusClass.replace('-bg','')}">${statusText}</td>
                    <td data-label="Días Háb. Restantes" ${daysRemainingNumber !== null ? `data-sort-value="${daysRemainingNumber}"` : ''}>${remainingText}</td>
                    <td data-label="Juzgado">${term.juzgado || '-'}</td>
                 `;
            }
            fragment.appendChild(tr);
        });
        tableBodyElement.appendChild(fragment);
    },

    /** Truncates text with an ellipsis */
    truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 1) + '…';
    },


    /**
     * Renderiza los controles de paginación.
     * @param {HTMLElement} paginationContainer - El div contenedor.
     * @param {number} totalItems - Total de ítems después de filtrar.
     * @param {number} itemsPerPage - Ítems por página.
     * @param {number} currentPage - Página actual.
     * @param {function(number):void} changePageCallback - Función a llamar al cambiar de página.
     */
    renderPaginationControls(paginationContainer, totalItems, itemsPerPage, currentPage, changePageCallback) {
        paginationContainer.innerHTML = ''; // Clear previous controls
        if (totalItems <= itemsPerPage) {
            return; // No pagination needed if items fit on one page
        }

        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const maxVisibleButtons = 5; // Max number of page buttons to show

        let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

        // Adjust startPage if endPage reaches the limit
        if (endPage === totalPages) {
            startPage = Math.max(1, totalPages - maxVisibleButtons + 1);
        }

        const fragment = document.createDocumentFragment();

        // Previous Button
        if (currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = '« Anterior';
            prevButton.dataset.page = currentPage - 1;
            fragment.appendChild(prevButton);
        }

        // Ellipsis at the start?
        if (startPage > 1) {
             const firstButton = document.createElement('button');
             firstButton.textContent = '1';
             firstButton.dataset.page = 1;
             fragment.appendChild(firstButton);
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'ellipsis';
                fragment.appendChild(ellipsis);
            }
        }


        // Page Number Buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.dataset.page = i;
            if (i === currentPage) {
                pageButton.disabled = true;
                pageButton.classList.add('active');
            }
            fragment.appendChild(pageButton);
        }

         // Ellipsis at the end?
         if (endPage < totalPages) {
             if (endPage < totalPages - 1) {
                 const ellipsis = document.createElement('span');
                 ellipsis.textContent = '...';
                 ellipsis.className = 'ellipsis';
                 fragment.appendChild(ellipsis);
             }
             const lastButton = document.createElement('button');
             lastButton.textContent = totalPages;
             lastButton.dataset.page = totalPages;
             fragment.appendChild(lastButton);
         }

        // Next Button
        if (currentPage < totalPages) {
            const nextButton = document.createElement('button');
            nextButton.textContent = 'Siguiente »';
            nextButton.dataset.page = currentPage + 1;
            fragment.appendChild(nextButton);
        }

        paginationContainer.appendChild(fragment);
    },

    /** Maneja clics en los botones de paginación (usando delegación) */
    handlePaginationClick(event, tableType) {
         const target = event.target;
         if (target.tagName === 'BUTTON' && target.dataset.page) {
             const newPage = parseInt(target.dataset.page, 10);
             if (!isNaN(newPage)) {
                 if (tableType === 'consulta') {
                     tableState.consulta.currentPage = newPage;
                     this.refreshConsultaTable();
                 } else {
                     tableState.vencimientos.currentPage = newPage;
                     this.refreshVencimientosTable();
                 }
             }
         }
    },

    /** Maneja clics en los botones de acción (Editar/Eliminar) */
    handleActionClick(event) {
        const target = event.target;
        const termId = target.dataset.id;

        if (!termId) return; // Clicked somewhere else

        if (target.classList.contains('edit')) {
            console.log(`Edit action for term ID: ${termId}`);
            FormManager.populateFormForEdit(termId);
        } else if (target.classList.contains('delete')) {
            console.log(`Delete action for term ID: ${termId}`);
            // Confirmation
            if (confirm(`¿Está seguro de que desea eliminar el término con ID ${termId}?\nEsta acción no se puede deshacer.`)) {
                try {
                     UIManager.showLoading('form-loading'); // Use a relevant loading indicator
                    const success = DataManager.deleteTermById(termId);
                    if (success) {
                        UIManager.showMessage('Término eliminado correctamente.', 'success');
                        this.refreshConsultaTable(); // Refresh both tables as data changed
                        this.refreshVencimientosTable();
                    } else {
                        UIManager.showMessage('Error: No se pudo encontrar o eliminar el término.', 'error');
                    }
                     UIManager.hideLoading('form-loading');
                } catch (error) {
                     console.error("Error deleting term:", error);
                     UIManager.showMessage('Error inesperado al eliminar el término.', 'error');
                     UIManager.hideLoading('form-loading');
                }
            }
        }
    },

    /** Maneja cambios en el input de búsqueda */
    handleSearch(event) {
        tableState.consulta.searchQuery = event.target.value;
        tableState.consulta.currentPage = 1; // Reset page on search
        this.refreshConsultaTable();
    },

    /** Maneja cambios en el select de ordenamiento */
    handleSortChange(event) {
        tableState.consulta.sortCriteria = event.target.value;
        tableState.consulta.currentPage = 1; // Reset page on sort change
        this.refreshConsultaTable();
    },

    /** Maneja cambios en el select de filtro de vencimientos */
    handleFilterChange(event) {
        tableState.vencimientos.filter = event.target.value;
        tableState.vencimientos.currentPage = 1; // Reset page on filter change
        this.refreshVencimientosTable();
    },

    /**
     * Obtiene la clase CSS de estado basada en los días restantes.
     * @param {{days: number, isPast: boolean}} remainingInfo - Objeto de calculateDaysRemaining.
     * @returns {string} Clase CSS ('urgent-bg', 'warning-bg', 'normal-bg').
     */
    getRowStatusClass(remainingInfo) {
        const config = DataManager.getCurrentConfig();
        if (remainingInfo.isPast || remainingInfo.days <= config.urgentDays) {
            return 'urgent-bg';
        } else if (remainingInfo.days <= config.warningDays) {
            return 'warning-bg';
        } else {
            return 'normal-bg';
        }
    }
};

// --- ConfigManager ---

const ConfigManager = {
    /** Inicializa los listeners y carga la configuración inicial */
    initConfig() {
        console.log("Initializing ConfigManager...");
        if (!configElements.configForm) {
            console.error("#configForm not found. ConfigManager cannot initialize.");
            return;
        }

        configElements.configForm.addEventListener('submit', this.handleConfigSubmit.bind(this));
        if (configElements.resetDefaultsButton) configElements.resetDefaultsButton.addEventListener('click', this.resetToDefaults.bind(this));

        // Data Management Listeners
        if (configElements.exportButton) configElements.exportButton.addEventListener('click', this.handleExport.bind(this));
        // The import button in HTML has onclick="DataManager.importData()". We should handle it here instead.
        if (configElements.importButton) {
             // Remove the inline handler if possible or just override
             configElements.importButton.onclick = null; // Remove inline handler
             configElements.importButton.addEventListener('click', this.handleImport.bind(this));
         }
        if (configElements.clearAllButton) configElements.clearAllButton.addEventListener('click', this.handleClearAll.bind(this));


        this.loadConfigIntoForm(); // Load initial values
        console.log("ConfigManager initialized.");
    },

    /** Carga la configuración actual en los campos del formulario */
    loadConfigIntoForm() {
        console.log("Loading config into form...");
        const config = DataManager.getCurrentConfig();
        if (!config) {
            console.error("Failed to load current config.");
            UIManager.showMessage("Error al cargar la configuración actual.", "error");
            return;
        }
        configElements.holidays.value = config.holidays || '';
        configElements.warningDays.value = config.warningDays;
        configElements.urgentDays.value = config.urgentDays;
        configElements.itemsPerPage.value = config.itemsPerPage;
         this.clearError('holidays'); // Clear validation errors on load
    },

    /**
     * Valida el formato del textarea de festivos.
     * @returns {boolean} True si es válido, false si no.
     */
     validateHolidays() {
        this.clearError('holidays');
        const holidaysString = configElements.holidays.value.trim();
        if (!holidaysString) return true; // Empty is valid

        const lines = holidaysString.split('\n');
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        let isValid = true;
        let invalidLines = [];

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine === '') return; // Skip empty lines

            if (!dateRegex.test(trimmedLine)) {
                isValid = false;
                invalidLines.push(index + 1);
            } else {
                 // Basic structural check passed, now check logical date validity
                 try {
                     const parts = trimmedLine.split('-').map(Number);
                     const dateObj = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
                     if (dateObj.getUTCFullYear() !== parts[0] ||
                         dateObj.getUTCMonth() !== parts[1] - 1 ||
                         dateObj.getUTCDate() !== parts[2] ||
                         isNaN(dateObj.getTime())) {
                         isValid = false;
                         invalidLines.push(index + 1);
                     }
                 } catch (e) {
                     isValid = false;
                     invalidLines.push(index + 1);
                 }
             }
        });

        if (!isValid) {
            this.showError('holidays', `Formato de fecha inválido (AAAA-MM-DD) o fecha no válida en línea(s): ${invalidLines.join(', ')}`);
        }
        return isValid;
    },

    /** Maneja el envío del formulario de configuración */
    async handleConfigSubmit(event) {
        event.preventDefault();
        console.log("Handling config submit...");

         if (!this.validateHolidays()) {
             UIManager.showMessage("Corrija el formato de los días festivos.", "error", 3000);
             configElements.holidays.focus();
             return;
         }

        UIManager.showLoading(configElements.configLoading.id);
        UIManager.clearMessage();

        // Get values, ensuring types
        const newConfig = {
            holidays: configElements.holidays.value.trim(), // Save trimmed version
            warningDays: parseInt(configElements.warningDays.value, 10) || DataManager.DEFAULT_CONFIG.warningDays,
            urgentDays: parseInt(configElements.urgentDays.value, 10) || DataManager.DEFAULT_CONFIG.urgentDays, // Allow 0
            itemsPerPage: parseInt(configElements.itemsPerPage.value, 10) || DataManager.DEFAULT_CONFIG.itemsPerPage,
        };

        // Simulate async operation (optional)
        // await new Promise(resolve => setTimeout(resolve, 300));

        try {
             const oldConfig = DataManager.getCurrentConfig(); // Get config before saving
            const saved = DataManager.saveConfig(newConfig, true); // True triggers potential recalculation

            if (saved) {
                UIManager.showMessage('Configuración guardada correctamente.', 'success');
                 // Refresh tables only if itemsPerPage changed or if holidays changed (saveConfig handles recalculation)
                 const holidaysChanged = oldConfig.holidays !== newConfig.holidays;
                 const itemsPerPageChanged = oldConfig.itemsPerPage !== newConfig.itemsPerPage;

                 // Check if recalculation actually happened (DataManager could expose this info)
                 // For now, assume recalculation happens if holidays change.
                 if (holidaysChanged || itemsPerPageChanged) {
                     console.log("Config change requires table refresh.");
                     TableManager.refreshConsultaTable();
                     TableManager.refreshVencimientosTable();
                 } else {
                      console.log("Config saved, no table refresh needed based on itemsPerPage/holidays diff.");
                 }

            } else {
                UIManager.showMessage('Error al guardar la configuración.', 'error');
            }
        } catch (error) {
             console.error("Error saving configuration:", error);
             UIManager.showMessage('Error inesperado al guardar la configuración.', 'error');
        } finally {
             UIManager.hideLoading(configElements.configLoading.id);
        }
    },

    /** Restaura la configuración a los valores predeterminados */
    resetToDefaults() {
        console.warn("Resetting config to defaults...");
        if (confirm("¿Está seguro de que desea restaurar la configuración a los valores predeterminados?\nLos días festivos personalizados se perderán.")) {
             UIManager.showLoading(configElements.configLoading.id);
            try {
                 const oldConfig = DataManager.getCurrentConfig();
                const success = DataManager.resetConfigToDefaults(true); // True triggers recalculation
                if (success) {
                    this.loadConfigIntoForm(); // Load defaults into form
                    UIManager.showMessage('Configuración restaurada a los valores predeterminados.', 'success');
                    // Check if refresh needed
                    const newConfig = DataManager.getCurrentConfig();
                     if (oldConfig.holidays !== newConfig.holidays || oldConfig.itemsPerPage !== newConfig.itemsPerPage) {
                         console.log("Config reset requires table refresh.");
                         TableManager.refreshConsultaTable();
                         TableManager.refreshVencimientosTable();
                     }

                } else {
                    UIManager.showMessage('Error al restaurar la configuración.', 'error');
                }
            } catch (error) {
                 console.error("Error resetting config:", error);
                 UIManager.showMessage('Error inesperado al restaurar la configuración.', 'error');
            } finally {
                 UIManager.hideLoading(configElements.configLoading.id);
            }
        }
    },

    /** Maneja la exportación de datos a CSV */
    handleExport() {
        console.log("Handling data export...");
        UIManager.clearMessage();
        try {
            const data = DataManager.loadData();
            if (data.length === 0) {
                UIManager.showMessage('No hay datos para exportar.', 'info', 3000);
                return;
            }

            const csvString = DataManager.convertToCSV(data);
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);

            link.setAttribute("href", url);
            // Generate filename with date
            const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            link.setAttribute("download", `lexterminus_backup_${dateStr}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url); // Clean up

            UIManager.showMessage(`Datos exportados (${data.length} registros).`, 'success');

        } catch (error) {
            console.error("Error during CSV export:", error);
            UIManager.showMessage('Error al generar el archivo CSV.', 'error');
        }
    },

    /** Maneja la importación de datos desde CSV */
    handleImport() {
        console.log("Handling data import...");
        UIManager.clearMessage();
        const fileInput = configElements.importFile;

        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            UIManager.showMessage('Por favor, seleccione un archivo CSV para importar.', 'info', 3000);
            return;
        }

        const file = fileInput.files[0];
        if (!file.name.toLowerCase().endsWith('.csv')) {
             UIManager.showMessage('Seleccione un archivo con extensión .csv.', 'error');
             return;
         }

        UIManager.showLoading(configElements.importLoading.id);
        const reader = new FileReader();

        reader.onload = (event) => {
            const csvString = event.target.result;
            try {
                const parsedData = DataManager.parseCSV(csvString);
                if (parsedData.length === 0) {
                    UIManager.showMessage('El archivo CSV está vacío o no se pudieron parsear datos válidos.', 'warning');
                    UIManager.hideLoading(configElements.importLoading.id);
                    fileInput.value = ''; // Reset file input
                    return;
                }

                // Confirmation step
                if (confirm(`Se encontraron ${parsedData.length} registros en el archivo CSV.\n¿Desea añadirlos a los datos existentes?\n(Nota: No se verificarán IDs duplicados, se añadirán todos)`)) {
                    let importedCount = 0;
                    let errorCount = 0;

                    // Import each term individually (can be slow for large files)
                     // A better approach would be bulk import in DataManager
                     parsedData.forEach(term => {
                         try {
                             // Maybe basic validation again before saving?
                            if(term && term.id && term.fechaInicio && typeof term.dias === 'number'){
                                 // Ensure date format consistency (recalculate? or trust CSV?)
                                 // Let's trust CSV for now, but recalculation might be safer.
                                 // term.fechaVencimiento = DataManager.calculateDueDate(term.fechaInicio, term.dias);
                                 const success = DataManager.saveOrUpdateTerm(term); // This uses existing logic (adds or updates)
                                 if(success) importedCount++;
                                 else errorCount++;
                            } else {
                                 console.warn("Skipping invalid term during import:", term);
                                 errorCount++;
                            }

                         } catch (saveError) {
                             console.error("Error saving imported term:", saveError, term);
                             errorCount++;
                         }
                     });

                    UIManager.showMessage(`Importación completada. ${importedCount} registros añadidos/actualizados, ${errorCount} errores.`, errorCount > 0 ? 'warning' : 'success');
                    if (importedCount > 0) {
                        TableManager.refreshConsultaTable();
                        TableManager.refreshVencimientosTable();
                    }
                } else {
                     UIManager.showMessage('Importación cancelada por el usuario.', 'info');
                }

            } catch (parseError) {
                console.error("Error parsing CSV file:", parseError);
                UIManager.showMessage(`Error al leer el archivo CSV: ${parseError.message}`, 'error');
            } finally {
                UIManager.hideLoading(configElements.importLoading.id);
                fileInput.value = ''; // Reset file input regardless of outcome
            }
        };

        reader.onerror = (event) => {
            console.error("Error reading file:", event.target.error);
            UIManager.showMessage('Error al leer el archivo seleccionado.', 'error');
            UIManager.hideLoading(configElements.importLoading.id);
            fileInput.value = '';
        };

        reader.readAsText(file); // Read the file
    },

    /** Maneja el borrado de todos los datos */
    handleClearAll() {
        console.warn("Handling Clear All Data...");
        UIManager.clearMessage();

        // Enhanced confirmation
        const confirmationPrompt = "¡PELIGRO! Esta acción eliminará TODOS los términos procesales guardados en este navegador.\n\nEsta acción es IRREVERSIBLE.\n\nPara confirmar, escriba 'BORRAR TODO' en el cuadro de abajo:";
        const confirmationText = prompt(confirmationPrompt);

        if (confirmationText === "BORRAR TODO") {
             UIManager.showLoading('config-loading'); // Use a general loading indicator
             try {
                const success = DataManager.deleteAllTerms();
                if (success) {
                    UIManager.showMessage('Todos los términos han sido eliminados.', 'success');
                    TableManager.refreshConsultaTable(); // Refresh tables (will be empty)
                    TableManager.refreshVencimientosTable();
                     FormManager.clearForm(); // Also clear form if user was editing
                } else {
                    UIManager.showMessage('Error al intentar eliminar los datos.', 'error');
                }
             } catch(error) {
                  console.error("Error during clear all:", error);
                  UIManager.showMessage('Error inesperado al eliminar los datos.', 'error');
             } finally {
                  UIManager.hideLoading('config-loading');
             }

        } else {
            UIManager.showMessage('Operación de borrado cancelada.', 'info');
        }
    },

    /** Muestra un error de validación para un campo de configuración */
     showError(inputId, message) {
         const errorElement = configElements[`${inputId}Error`]; // e.g., holidaysError
         if (errorElement) {
             errorElement.textContent = message;
             errorElement.style.display = 'block';
             const inputElement = configElements[inputId];
             inputElement?.setAttribute('aria-invalid', 'true');
             inputElement?.setAttribute('aria-describedby', errorElement.id);
         }
     },

     /** Limpia un error de validación para un campo de configuración */
     clearError(inputId) {
         const errorElement = configElements[`${inputId}Error`];
         if (errorElement) {
             errorElement.textContent = '';
             errorElement.style.display = 'none';
              const inputElement = configElements[inputId];
             inputElement?.removeAttribute('aria-invalid');
             inputElement?.removeAttribute('aria-describedby');
         }
     },
};


// --- Inicialización General de la Aplicación ---

function initializeApp() {
    console.log("DOM fully loaded. Initializing application...");
    try {
        DataManager.loadConfig(); // Cargar configuración primero
        UIManager.initUIManager(); // Inicializar UI (listeners generales, estado inicial)
        FormManager.initForm(); // Inicializar formulario (listeners, estado inicial)
        TableManager.initTables(); // Inicializar tablas (listeners)
        ConfigManager.initConfig(); // Inicializar config (listeners, cargar datos en form)

         // Listener para cargar tablas cuando se entra a la app
         document.addEventListener('appEntered', () => {
             console.log("App entered, performing initial table load.");
             TableManager.refreshConsultaTable();
             TableManager.refreshVencimientosTable();
         });

         // Listener para refrescar tablas cuando se guarda un término
          document.addEventListener('termSaved', () => {
             console.log("Term saved event detected, refreshing tables.");
             TableManager.refreshConsultaTable();
             TableManager.refreshVencimientosTable();
         });


        console.log("Application initialization complete.");

    } catch (error) {
        console.error("CRITICAL ERROR during application initialization:", error);
        // Display a critical error message to the user if possible
         const body = document.body;
         const errorDiv = document.createElement('div');
         errorDiv.style.position = 'fixed';
         errorDiv.style.top = '0';
         errorDiv.style.left = '0';
         errorDiv.style.width = '100%';
         errorDiv.style.backgroundColor = 'red';
         errorDiv.style.color = 'white';
         errorDiv.style.padding = '10px';
         errorDiv.style.textAlign = 'center';
         errorDiv.style.zIndex = '10000';
         errorDiv.textContent = `Error Crítico al iniciar la aplicación: ${error.message}. Por favor, recargue la página o contacte soporte.`;
         body.prepend(errorDiv);
         // Hide the main app potentially
         if(uiElements.appSection) uiElements.appSection.style.display = 'none';
         if(uiElements.landingSection) uiElements.landingSection.style.display = 'none';

    }
}

// Esperar a que el DOM esté listo para inicializar todo
document.addEventListener('DOMContentLoaded', initializeApp);

// Indicate Module 3 has loaded
console.log("Module 3 (Tables, Config, Init) loaded.");
// --- End of module3.js --- Approx 600+ lines ---

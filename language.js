// Single source of truth for the active language across every page.
const LEGAL_LENS_LANGUAGE_KEY = "legalLensLanguage";

// Native display names for the supported language codes, used only to
// keep the language dropdown's aria-label in sync with the active language.
const LEGAL_LENS_LANGUAGE_NAMES = {
    en: "English",
    hi: "हिंदी",
    mr: "मराठी",
    ta: "தமிழ்"
};

function changeLanguage(language) {
    const selectedLanguage = translations[language];

    if (!selectedLanguage) {
        return;
    }

    // Change all elements having data-i18n
    document.querySelectorAll("[data-i18n]").forEach((element) => {
        const key = element.getAttribute("data-i18n");

        if (selectedLanguage[key]) {
            element.textContent = selectedLanguage[key];
        }
    });

    // Keep the language dropdown (desktop + mobile) in sync with the
    // active language. Safe no-op on pages that don't have it.
    updateLanguageSelectorUI(language);

    // Let pages with their own dynamically generated, language-aware
    // content (e.g. the Home page feature carousel) refresh their text.
    if (typeof window.onLegalLensLanguageChange === "function") {
        window.onLegalLensLanguageChange(language);
    }

    // Save selected language
    localStorage.setItem(LEGAL_LENS_LANGUAGE_KEY, language);
}

// Updates the desktop + mobile language dropdown UI (checkmarks and
// aria attributes) so the visibly selected language always matches the
// active language. Guarded so it does nothing on pages without these
// elements.
function updateLanguageSelectorUI(language) {
    const nativeName = LEGAL_LENS_LANGUAGE_NAMES[language] || language;

    document.querySelectorAll(".lang-option").forEach((btn) => {
        const optionLi = btn.closest("li");
        const isMatch = btn.dataset.lang === language;
        if (optionLi) {
            optionLi.setAttribute("aria-checked", isMatch ? "true" : "false");
        }
    });

    document.querySelectorAll(".mobile-lang-option").forEach((btn) => {
        btn.setAttribute("aria-checked", btn.dataset.lang === language ? "true" : "false");
    });

    const langTrigger = document.getElementById("langTrigger");
    if (langTrigger) {
        langTrigger.setAttribute("aria-label", "Language, currently " + nativeName);
    }
}


// Apply saved language when page loads
document.addEventListener("DOMContentLoaded", () => {

    const savedLanguage =
        localStorage.getItem(LEGAL_LENS_LANGUAGE_KEY) || "en";

    changeLanguage(savedLanguage);

});
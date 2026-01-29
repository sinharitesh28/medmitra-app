const I18N = {
    en: {
        title: "MedMitra Registration",
        patient_details: "Patient Details",
        opd_label: "OPD Number",
        name_placeholder: "e.g. Rajesh Kumar",
        submit_btn: "Generate QR & Register",
        waiting_consent: "Waiting for patient consent..."
    },
    hi: {
        title: "मेडमित्र पंजीकरण",
        patient_details: "रोगी का विवरण",
        opd_label: "ओपीडी संख्या",
        name_placeholder: "जैसे: राजेश कुमार",
        submit_btn: "क्यूआर जेनरेट करें और रजिस्टर करें",
        waiting_consent: "रोगी की सहमति की प्रतीक्षा है..."
    }
    // Add more as needed
};

function getTranslation(lang, key) {
    return I18N[lang] ? I18N[lang][key] : I18N['en'][key];
}

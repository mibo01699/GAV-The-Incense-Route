// AuctionLocalizationEngine.js - دعم متعدد اللغات

const translations = {
    en: { welcome: 'Welcome to GAV Supply Chain' },
    ar: { welcome: 'مرحباً بك في سلسلة توريد GAV' },
    // ... باقي اللغات
};

class AuctionLocalizationEngine {
    detectAndGetTranslation(acceptLanguage) {
        const lang = acceptLanguage?.split(',')[0]?.split('-')[0] || 'en';
        return translations[lang] || translations.en;
    }
}

module.exports = new AuctionLocalizationEngine();
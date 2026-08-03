const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// مسار الاستبيان العشوائي السعري الموزع على نقاط البيع لربطه مع سلة أجيال الإغاثية
app.get('/api/pricing-poll', (req, res) => {
    // محاكاة الإجماع السعري العشوائي لمنع التزوير والتضخم
    const baseSurveyPrice = Math.floor(Math.random() * (120 - 90 + 1)) + 90; 
    res.json({ status: "SUCCESS", system: "BY-GAV-YEM-2026-STABLE", calibratedPriceYER: baseSurveyPrice });
});

app.listen(PORT, () => console.log(`🚀 GAV Incense Route Server running automatically on port ${PORT}`));

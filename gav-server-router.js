// GAV REST API Router - Replit Infrastructure Mapping Node
// Links Logistics Escrow, AJYAL Vouchers, POS Checkouts, and Multi-Lingual AI Assistance

import express from 'express';
import GavPosEngineV2 from './gav-pos-engine-v2.js';
import AuctionSupportSystem from '../suppliers-auction/AuctionSupportSystem.js';

const router = express.Router();
const memoryRegistryCache = new Map();
const posEngine = new GavPosEngineV2(memoryRegistryCache);
const supportSystem = new AuctionSupportSystem();

/**
 * 1. واجهة معالجة الفاتورة الهجينة لنقاط البيع بالتجزئة والتعاونيات الزراعية
 * POST /api/pos/hybrid-checkout
 */
router.post('/api/pos/hybrid-checkout', (req, res) => {
    const { invoiceId, posTerminalId, nominalTotalValue, currentDexRateYerPerPi } = req.body;
    try {
        const clearingPayload = posEngine.processHybridCheckout(invoiceId, posTerminalId, nominalTotalValue, currentDexRateYerPerPi);
        res.status(200).json({ success: true, payload: clearingPayload });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * 2. واجهة صرف وتحقق أكواد المعونات الإنسانية عينات الـ POS بالتكامل مع AJYAL
 * POST /api/pos/redeem-voucher
 */
router.post('/api/pos/redeem-voucher', async (req, res) => {
    const { voucherCode, beneficiaryWallet, terminalId, languagePreferenceCode } = req.body;
    try {
        const redemptionReport = await posEngine.redeemAjyalAidVoucher(
            voucherCode, 
            beneficiaryWallet, 
            terminalId, 
            languagePreferenceCode || "en"
        );
        res.status(200).json({ success: true, report: redemptionReport });
    } catch (error) {
        if (beneficiaryWallet) posEngine.releaseBeneficiaryLock(beneficiaryWallet);
        res.status(403).json({ success: false, error: error.message });
    }
});

/**
 * 3. واجهة مساعد الدعم الفني بالذكاء الاصطناعي للمزارعين ونقاط البيع باللغات الـ 11 المحدثة
 * POST /api/gav/ai-consult
 */
router.post('/api/gav/ai-consult', (req, res) => {
    const { queryText, evaluationValueNominal, languagePreferenceCode } = req.body;
    try {
        const aiVerdict = supportSystem.consultAiAssistantEngine(queryText, evaluationValueNominal, languagePreferenceCode || "en");
        res.status(200).json({ success: true, response: aiVerdict });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

export default router;

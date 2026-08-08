// ============================================================
// الملف: payment-processor.js
// المسار: GAV-The-Incense-Route/payment-processor.js
// الدور: تنفيذ الدفع الهجين مع تكامل حقيقي مع BIGISH-YER
// ============================================================

const HybridPaymentCalculator = require('./payment-calculator');
const { HYBRID_CONFIG } = require('./hybrid-payment-config');

// عنوان خادم BIGISH-YER (يجب تعيينه كمتغير بيئي)
const BIGISH_YER_API = process.env.BIGISH_YER_API || 'http://localhost:5001/api';

class HybridPaymentProcessor {
    constructor() {
        this.calculator = new HybridPaymentCalculator();
    }

    async processHybridPayment(paymentRequest) {
        const {
            productPriceUSD,
            buyerPiWallet,
            buyerYerWalletId,  // معرف محفظة YER للمشتري (من BIGISH-YER)
            sellerPiWallet,
            sellerYerWalletId, // معرف محفظة YER للبائع (من BIGISH-YER)
            piPercent,
            yerPercent
        } = paymentRequest;

        try {
            // 1. حساب تفاصيل الدفع
            const paymentDetails = this.calculator.calculatePaymentSplit(
                productPriceUSD,
                piPercent,
                yerPercent
            );

            console.log('📊 تفاصيل الدفع المحسوبة:', paymentDetails);

            // 2. تنفيذ دفعة Pi (سيتم استبدالها بتكامل Pi SDK الحقيقي)
            const piPaymentResult = await this.executePiPayment(
                buyerPiWallet,
                sellerPiWallet,
                paymentDetails.piAmount.pi
            );

            if (!piPaymentResult.success) {
                throw new Error(`فشل دفع Pi: ${piPaymentResult.message}`);
            }

            // 3. تنفيذ دفعة YER عبر BIGISH-YER (التكامل الحقيقي)
            const yerPaymentResult = await this.executeYerPaymentViaAPI(
                buyerYerWalletId,
                sellerYerWalletId,
                paymentDetails.yerAmount.yer,
                `دفعة للمزاد/الفاتورة (GCV: ${HYBRID_CONFIG.GCV_VALUE_USD})`
            );

            if (!yerPaymentResult.success) {
                throw new Error(`فشل دفع YER: ${yerPaymentResult.error}`);
            }

            // 4. إضافة السيولة (محاكاة - سيتم استبدالها بتكامل DEX)
            const liquidityResult = await this.addToLiquidityPool(
                paymentDetails.piAmount.pi,
                paymentDetails.yerAmount.yer,
                HYBRID_CONFIG.LIQUIDITY_POOLS
            );

            if (!liquidityResult.success) {
                console.warn('⚠️ تحذير: فشل إضافة السيولة إلى DEX، ولكن تمت المعاملة بنجاح');
            }

            return {
                success: true,
                paymentDetails,
                piPayment: piPaymentResult,
                yerPayment: yerPaymentResult,
                liquidity: liquidityResult,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ خطأ في معالجة الدفع الهجين:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // ============================================================
    // دالة تنفيذ تحويل YER عبر API (التكامل الحقيقي)
    // ============================================================
    async executeYerPaymentViaAPI(fromWalletId, toWalletId, amount, description) {
        try {
            console.log(`💳 طلب تحويل YER: ${amount} من ${fromWalletId} إلى ${toWalletId}`);

            const response = await fetch(`${BIGISH_YER_API}/yer/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromWalletId,
                    toWalletId,
                    amount,
                    description
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'فشل تحويل YER');
            }

            console.log('✅ تم تحويل YER بنجاح:', data.transaction);
            return {
                success: true,
                transaction: data.transaction,
                fromBalance: data.fromBalance,
                toBalance: data.toBalance
            };
        } catch (error) {
            console.error('❌ خطأ في تحويل YER عبر API:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ============================================================
    // دوال المحاكاة (سيتم استبدالها بتكامل حقيقي لاحقاً)
    // ============================================================
    async executePiPayment(fromWallet, toWallet, amount) {
        console.log(`💳 دفع ${amount} Pi من ${fromWallet} إلى ${toWallet} (محاكاة)`);
        return { success: true, transactionId: 'pi_tx_' + Date.now() };
    }

    async addToLiquidityPool(piAmount, yerAmount, pools) {
        console.log(`💧 إضافة ${piAmount} Pi و ${yerAmount} YER إلى مجمعات السيولة (محاكاة)`);
        return { success: true, poolId: 'pool_' + Date.now() };
    }

    updateSellerRatios(newPiPercent, newYerPercent) {
        this.calculator.updateSellerRatios(newPiPercent, newYerPercent);
    }
}

module.exports = HybridPaymentProcessor;
// ============================================================
// الملف: payment-calculator.test.js
// المسار: GAV/tests/payment-calculator.test.js
// الدور: اختبار دقة حسابات الدفع الهجين
// ============================================================

const HybridPaymentCalculator = require('../payment-calculator');

describe('HybridPaymentCalculator', () => {
    let calculator;

    beforeEach(() => {
        calculator = new HybridPaymentCalculator({
            GCV_VALUE_USD: 314159,
            YER_TO_USD_RATE: 0.0007,
            DEFAULT_PI_PERCENT: 5,
            DEFAULT_YER_PERCENT: 95
        });
    });

    test('should calculate correct split for 100 USD', () => {
        const result = calculator.calculatePaymentSplit(100);
        expect(result.piPercent).toBe(5);
        expect(result.yerPercent).toBe(95);
        expect(result.piAmount.usd).toBe(5);
        expect(result.yerAmount.usd).toBe(95);
        expect(result.piAmount.pi).toBeCloseTo(0.0000159, 7);
    });

    test('should throw error if percentages do not sum to 100', () => {
        expect(() => {
            calculator.calculatePaymentSplit(100, 10, 85);
        }).toThrow('مجموع النسب يجب أن يساوي 100%');
    });
});
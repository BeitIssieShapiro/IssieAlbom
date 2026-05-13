import { initLang } from '@beitissieshapiro/issie-shared';
import { getLocales } from 'react-native-localize';

const feedbackStrings = {
  he: {
    UserFeedback: 'משוב משתמש',
    Feedback: 'משוב',
    FeedbackTitleLabel: 'כותרת / נושא',
    FeedbackTitlePlaceholder: 'כותרת קצרה או נושא',
    FeedbackPlaceholder: 'שתפו אותנו במה שעל ליבכם...',
    EmailTitle: 'אימייל (אופציונלי)',
    EmailPlaceholder: 'your@email.com',
    BtnCancel: 'ביטול',
    BtnSubmitFeedback: 'שליחה',
    FeedbackSubmitted: 'תודה! המשוב נשלח בהצלחה',
    FeedbackError: 'שליחת המשוב נכשלה. נסו שוב.',
    TitleMinLength: 'הכותרת חייבת להכיל לפחות 3 תווים',
    TitleMaxLength: 'הכותרת חייבת להכיל פחות מ-100 תווים',
    FeedbackMinLength: 'המשוב חייב להכיל לפחות 5 תווים',
    FeedbackMaxLength: 'המשוב חייב להכיל פחות מ-1000 תווים',
    InvalidEmail: 'כתובת אימייל לא תקינה',
  },
  en: {
    UserFeedback: 'User Feedback',
    Feedback: 'Feedback',
    FeedbackTitleLabel: 'Title / Subject',
    FeedbackTitlePlaceholder: 'Enter a brief title or subject',
    FeedbackPlaceholder: 'Share your thoughts with us...',
    EmailTitle: 'Email (optional)',
    EmailPlaceholder: 'your@email.com',
    BtnCancel: 'Cancel',
    BtnSubmitFeedback: 'Submit',
    FeedbackSubmitted: 'Thank you! Your feedback was submitted successfully',
    FeedbackError: 'Failed to submit feedback. Please try again.',
    TitleMinLength: 'Title must be at least 3 characters',
    TitleMaxLength: 'Title must be less than 100 characters',
    FeedbackMinLength: 'Feedback must be at least 5 characters',
    FeedbackMaxLength: 'Feedback must be less than 1000 characters',
    InvalidEmail: 'Invalid email address',
  },
  ar: {
    UserFeedback: 'ملاحظات المستخدم',
    Feedback: 'ملاحظات',
    FeedbackTitleLabel: 'العنوان / الموضوع',
    FeedbackTitlePlaceholder: 'أدخل عنوانًا موجزًا أو موضوعًا',
    FeedbackPlaceholder: 'شارك أفكارك معنا...',
    EmailTitle: 'البريد الإلكتروني (اختياري)',
    EmailPlaceholder: 'your@email.com',
    BtnCancel: 'إلغاء',
    BtnSubmitFeedback: 'إرسال',
    FeedbackSubmitted: 'شكرًا! تم إرسال ملاحظاتك بنجاح',
    FeedbackError: 'فشل إرسال الملاحظات. حاول مرة أخرى.',
    TitleMinLength: 'يجب أن يكون العنوان 3 أحرف على الأقل',
    TitleMaxLength: 'يجب أن يكون العنوان أقل من 100 حرف',
    FeedbackMinLength: 'يجب أن تكون الملاحظات 5 أحرف على الأقل',
    FeedbackMaxLength: 'يجب أن تكون الملاحظات أقل من 1000 حرف',
    InvalidEmail: 'عنوان البريد الإلكتروني غير صالح',
  },
};

export function initIssieSharedLang(): void {
  const locales = getLocales();
  const lang = locales[0]?.languageCode ?? 'en';
  const tag = locales[0]?.languageTag ?? 'en';
  const isRTL = lang === 'he' || lang === 'ar';
  initLang(feedbackStrings, { languageTag: tag, isRTL });
}

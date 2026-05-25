import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "photoWarning": "Warning: This photo will be visible to anyone who scans the QR code.",
      "takeSelfie": "Take Selfie",
      "retakePhoto": "Remove / Retake",
      "createContract": "Create Contract",
      "myDetails": "My Details (Borrower)",
      "lenderDetails": "Lender Details",
      "witnesses": "Witnesses (Optional)",
      "debtTerms": "Debt Terms",
      "firstName": "First Name",
      "lastName": "Last Name",
      "patronymic": "Patronymic",
      "phone": "Phone Number",
      "address": "Address",
      "username": "Telegram Username",
      "addWitness": "Add Witness",
      "remove": "Remove",
      "currency": "Currency",
      "totalAmount": "Total Debt Amount",
      "monthlyAmount": "Monthly Repayment",
      "description": "Description / Purpose",
      "monthsToRepay": "{{count}} months to repay",
      "lastPayment": "Last payment: {{amount}}",
      "submit": "Create Contract",
      "language": "Language",
      "contractCreated": "Contract created successfully!"
    }
  },
  uz: {
    translation: {
      "photoWarning": "Ogohlantirish: Bu rasm QR kodni skaner qilgan har kimga ko'rinadi.",
      "takeSelfie": "Selfi olish",
      "retakePhoto": "O'chirish / Qaytadan olish",
      "createContract": "Shartnoma yaratish",
      "myDetails": "Mening ma'lumotlarim (Qarz oluvchi)",
      "lenderDetails": "Qarz beruvchi ma'lumotlari",
      "witnesses": "Guvohlar (Ixtiyoriy)",
      "debtTerms": "Qarz shartlari",
      "firstName": "Ism",
      "lastName": "Familiya",
      "patronymic": "Otasining ismi",
      "phone": "Telefon raqami",
      "address": "Manzil",
      "username": "Telegram foydalanuvchi nomi",
      "addWitness": "Guvoh qo'shish",
      "remove": "O'chirish",
      "currency": "Valyuta",
      "totalAmount": "Qarzning umumiy miqdori",
      "monthlyAmount": "Oylik to'lov",
      "description": "Tavsif / Maqsad",
      "monthsToRepay": "To'lash uchun {{count}} oy",
      "lastPayment": "Oxirgi to'lov: {{amount}}",
      "submit": "Shartnoma yaratish",
      "language": "Til",
      "contractCreated": "Shartnoma muvaffaqiyatli yaratildi!"
    }
  },
  ru: {
    translation: {
      "photoWarning": "Внимание: Это фото будет видно всем, кто отсканирует QR-код.",
      "takeSelfie": "Сделать селфи",
      "retakePhoto": "Удалить / Переснять",
      "createContract": "Создать договор",
      "myDetails": "Мои данные (Заемщик)",
      "lenderDetails": "Данные кредитора",
      "witnesses": "Свидетели (Необязательно)",
      "debtTerms": "Условия долга",
      "firstName": "Имя",
      "lastName": "Фамилия",
      "patronymic": "Отчество",
      "phone": "Номер телефона",
      "address": "Адрес",
      "username": "Имя пользователя Telegram",
      "addWitness": "Добавить свидетеля",
      "remove": "Удалить",
      "currency": "Валюта",
      "totalAmount": "Общая сумма долга",
      "monthlyAmount": "Ежемесячный платеж",
      "description": "Описание / Цель",
      "monthsToRepay": "{{count}} месяцев на погашение",
      "lastPayment": "Последний платеж: {{amount}}",
      "submit": "Создать договор",
      "language": "Язык",
      "contractCreated": "Договор успешно создан!"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('appLang') || 'en', // Default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;

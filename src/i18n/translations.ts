import { LanguageCode } from './types';

interface Translations {
  // Home Screen
  home: {
    title: string;
    loading: string;
    empty: string;
    newAlbum: string;
    newAlbumPrompt: string;
    albumNamePlaceholder: string;
    cancel: string;
    create: string;
    error: string;
    errorLoadAlbums: string;
    errorEnterName: string;
    errorCreateAlbum: string;
    errorDeleteAlbum: string;
    errorRenameAlbum: string;
    deleteAlbumTitle: string;
    deleteAlbumMessage: string;
    delete: string;
    renameAlbumTitle: string;
    renameAlbumPrompt: string;
    rename: string;
  };

  // Album Screen
  album: {
    edit: string;
    done: string;
    noPages: string;
    errorLoadPages: string;
    errorSavePage: string;
    errorCreatePage: string;
    errorDeletePage: string;
    deletePageTitle: string;
    deletePageMessage: string;
    creatingPage: string;
    deletingPage: string;
  };

  // Page Editor Screen
  editor: {
    page: string;
    permissions: string;
    permissionsMessage: string;
    errorRecording: string;
    errorStopRecording: string;
    errorPlayRecording: string;
    errorSaveRecording: string;
    errorSaveImage: string;
    sketchPen: string;
    pen: string;
    emoji: string;
    emojis: string;
    textInput: string;
    addImage: string;
    addAudio: string;
    audio: string;
    addLine: string;
    addTable: string;
    background: string;
    undo: string;
    redo: string;
    recording: string;
    stopRecording: string;
    playRecording: string;
    saveRecording: string;
    deleteRecording: string;
    camera: string;
    color: string;
    size: string;
    thickness: string;
    textTitle: string;
    textBody: string;
    fromGallery: string;
    rotation: string;
    emojiSize: string;
    deleteEmoji: string;
    noBackground: string;
    solidColor: string;
    wordMapping: string;
    play: string;
    startRecording: string;
  };

  // Settings Screen
  settings: {
    title: string;
    selectTheme: string;
    selectLanguage: string;
    restartRequired: string;
    restartMessage: string;
    ok: string;
  };

  // About Screen
  about: {
    title: string;
  };

  // Album Card
  albumCard: {
    menuRename: string;
    menuDelete: string;
    menuCancel: string;
  };

  // Theme Names
  themes: {
    girly: string;
    boyish: string;
    solid: string;
    sparkly: string;
  };

  // Background Settings
  background: {
    title: string;
    solidColors: string;
    patterns: string;
    image: string;
    selectImage: string;
    removeBackground: string;
  };

  // Audio Word Mapping
  audioWordMapping: {
    title: string;
    instructions: string;
    save: string;
  };

  // Camera Modal
  camera: {
    takePhoto: string;
  };

  // Image Search Modal
  imageSearch: {
    title: string;
    search: string;
    searchPlaceholder: string;
    noResults: string;
  };

  // Export/Import
  export: {
    share: string;
    exportAsAlbum: string;
    exportAsPDF: string;
    exportingAlbum: string;
    exportingPDF: string;
    exportComplete: string;
    exportFailed: string;
    generatingPDF: string;
    capturingPages: string;
  };

  import: {
    importAlbum: string;
    importingAlbum: string;
    importComplete: string;
    importFailed: string;
    invalidZipFile: string;
    albumAlreadyExists: string;
    renameAlbum: string;
    replaceAlbum: string;
    enterNewName: string;
  };

  // Backup/Restore
  backup: {
    title: string;
    backupAllAlbums: string;
    restoreFromBackup: string;
    backupInProgress: string;
    backupComplete: string;
    restoreInProgress: string;
    restoreComplete: string;
    albumsImported: string;
    albumsSkipped: string;
    backupFailed: string;
    restoreFailed: string;
    noAlbumsToBackup: string;
  };
}

export const translations: Record<LanguageCode, Translations> = {
  he: {
    home: {
      title: 'האלבומים שלי',
      loading: 'טוען אלבומים...',
      empty: 'אין אלבומים עדיין. לחצו על + ליצירת האלבום הראשון!',
      newAlbum: 'אלבום חדש',
      newAlbumPrompt: 'אלבום חדש',
      albumNamePlaceholder: 'שם האלבום',
      cancel: 'ביטול',
      create: 'יצירה',
      error: 'שגיאה',
      errorLoadAlbums: 'טעינת האלבומים נכשלה',
      errorEnterName: 'נא להזין שם לאלבום',
      errorCreateAlbum: 'יצירת האלבום נכשלה',
      errorDeleteAlbum: 'מחיקת האלבום נכשלה',
      errorRenameAlbum: 'שינוי שם האלבום נכשל',
      deleteAlbumTitle: 'מחיקת אלבום',
      deleteAlbumMessage: 'האם למחוק את "{name}"? לא ניתן לבטל פעולה זו.',
      delete: 'מחיקה',
      renameAlbumTitle: 'שינוי שם אלבום',
      renameAlbumPrompt: 'הזן שם חדש:',
      rename: 'שינוי שם',
    },

    album: {
      edit: 'עריכה',
      done: 'סיום',
      noPages: 'אין עמודים באלבום',
      errorLoadPages: 'טעינת העמודים נכשלה',
      errorSavePage: 'שמירת העמוד נכשלה',
      errorCreatePage: 'יצירת העמוד נכשלה',
      errorDeletePage: 'מחיקת העמוד נכשלה',
      deletePageTitle: 'מחיקת עמוד',
      deletePageMessage: 'האם למחוק עמוד זה? לא ניתן לבטל פעולה זו.',
      creatingPage: 'יוצר עמוד...',
      deletingPage: 'מוחק עמוד...',
    },

    editor: {
      page: 'עמוד',
      permissions: 'הרשאות',
      permissionsMessage: 'יש לאפשר הרשאות הקלטה ושמירת קבצים',
      errorRecording: 'ההקלטה נכשלה',
      errorStopRecording: 'עצירת ההקלטה נכשלה',
      errorPlayRecording: 'הפעלת ההקלטה נכשלה',
      errorSaveRecording: 'שמירת ההקלטה נכשלה',
      errorSaveImage: 'שמירת התמונה נכשלה',
      sketchPen: 'עט',
      pen: 'עט',
      emoji: 'אימוג\'י',
      emojis: 'אימוג\'ים',
      textInput: 'טקסט',
      addImage: 'הוסף תמונה',
      addAudio: 'הקלטה',
      audio: 'שמע',
      addLine: 'קו',
      addTable: 'טבלה',
      background: 'רקע',
      undo: 'ביטול פעולה',
      redo: 'ביצוע מחדש',
      recording: 'מקליט...',
      stopRecording: 'עצור הקלטה',
      playRecording: 'נגן הקלטה',
      saveRecording: 'שמור הקלטה',
      deleteRecording: 'מחק הקלטה',
      camera: 'מצלמה',
      color: 'צבע',
      size: 'גודל',
      thickness: 'עובי',
      textTitle: 'כותרת',
      textBody: 'גוף',
      fromGallery: 'מגלריה',
      rotation: 'סיבוב',
      emojiSize: 'גודל אימוג\'י',
      deleteEmoji: 'מחק אימוג\'י',
      noBackground: 'ללא רקע',
      solidColor: 'צבע אחיד',
      wordMapping: 'מיפוי מילים',
      play: 'השמע',
      startRecording: 'התחל הקלטה',
    },

    settings: {
      title: 'הגדרות',
      selectTheme: 'בחר ערכת נושא',
      selectLanguage: 'בחר שפה',
      restartRequired: 'נדרש אתחול',
      restartMessage: 'יש להפעיל מחדש את האפליקציה כדי שהשינוי ייכנס לתוקף.',
      ok: 'אישור',
    },

    about: {
      title: 'אודות',
    },

    albumCard: {
      menuRename: 'שינוי שם',
      menuDelete: 'מחיקה',
      menuCancel: 'ביטול',
    },

    themes: {
      girly: 'ילדותי',
      boyish: 'בנים',
      solid: 'מבוגרים',
      sparkly: 'נוצץ',
    },

    background: {
      title: 'הגדרות רקע',
      solidColors: 'צבעים אחידים',
      patterns: 'תבניות',
      image: 'תמונה',
      selectImage: 'בחר תמונה',
      removeBackground: 'הסר רקע',
    },

    audioWordMapping: {
      title: 'מיפוי מילים',
      instructions: 'הקש על מילה כדי לסמן את הזמן שלה בהקלטה',
      save: 'שמור',
    },

    camera: {
      takePhoto: 'צלם תמונה',
    },

    imageSearch: {
      title: 'חיפוש תמונה',
      search: 'חיפוש',
      searchPlaceholder: 'הקלד מילת חיפוש...',
      noResults: 'לא נמצאו תוצאות',
    },

    export: {
      share: 'שיתוף',
      exportAsAlbum: 'ייצוא כאלבום (ZIP)',
      exportAsPDF: 'ייצוא כ-PDF',
      exportingAlbum: 'מייצא אלבום...',
      exportingPDF: 'מייצר PDF...',
      exportComplete: 'הייצוא הושלם',
      exportFailed: 'הייצוא נכשל',
      generatingPDF: 'יוצר PDF',
      capturingPages: 'לוכד עמודים',
    },

    import: {
      importAlbum: 'ייבוא אלבום',
      importingAlbum: 'מייבא אלבום...',
      importComplete: 'הייבוא הושלם',
      importFailed: 'הייבוא נכשל',
      invalidZipFile: 'קובץ ZIP לא תקין',
      albumAlreadyExists: 'אלבום בשם זה כבר קיים',
      renameAlbum: 'שנה שם',
      replaceAlbum: 'החלף',
      enterNewName: 'הזן שם חדש:',
    },

    backup: {
      title: 'גיבוי ושחזור',
      backupAllAlbums: 'גבה את כל האלבומים',
      restoreFromBackup: 'שחזר מגיבוי',
      backupInProgress: 'מבצע גיבוי...',
      backupComplete: 'הגיבוי הושלם',
      restoreInProgress: 'משחזר מגיבוי...',
      restoreComplete: 'השחזור הושלם',
      albumsImported: 'אלבומים יובאו',
      albumsSkipped: 'אלבומים דולגו',
      backupFailed: 'הגיבוי נכשל',
      restoreFailed: 'השחזור נכשל',
      noAlbumsToBackup: 'אין אלבומים לגיבוי',
    },
  },

  en: {
    home: {
      title: 'My Albums',
      loading: 'Loading albums...',
      empty: 'No albums yet. Tap + to create your first album!',
      newAlbum: 'New Album',
      newAlbumPrompt: 'New Album',
      albumNamePlaceholder: 'Album Name',
      cancel: 'Cancel',
      create: 'Create',
      error: 'Error',
      errorLoadAlbums: 'Failed to load albums',
      errorEnterName: 'Please enter an album name',
      errorCreateAlbum: 'Failed to create album',
      errorDeleteAlbum: 'Failed to delete album',
      errorRenameAlbum: 'Failed to rename album',
      deleteAlbumTitle: 'Delete Album',
      deleteAlbumMessage: 'Delete "{name}"? This cannot be undone.',
      delete: 'Delete',
      renameAlbumTitle: 'Rename Album',
      renameAlbumPrompt: 'Enter new name:',
      rename: 'Rename',
    },

    album: {
      edit: 'Edit',
      done: 'Done',
      noPages: 'No pages in album',
      errorLoadPages: 'Failed to load pages',
      errorSavePage: 'Failed to save page',
      errorCreatePage: 'Failed to create page',
      errorDeletePage: 'Failed to delete page',
      deletePageTitle: 'Delete Page',
      deletePageMessage: 'Delete this page? This cannot be undone.',
      creatingPage: 'Creating page...',
      deletingPage: 'Deleting page...',
    },

    editor: {
      page: 'Page',
      permissions: 'Permissions',
      permissionsMessage: 'Please allow recording and file storage permissions',
      errorRecording: 'Recording failed',
      errorStopRecording: 'Failed to stop recording',
      errorPlayRecording: 'Failed to play recording',
      errorSaveRecording: 'Failed to save recording',
      errorSaveImage: 'Failed to save image',
      sketchPen: 'Pen',
      pen: 'Pen',
      emoji: 'Emoji',
      emojis: 'Emojis',
      textInput: 'Text',
      addImage: 'Add Image',
      addAudio: 'Audio',
      audio: 'Audio',
      addLine: 'Line',
      addTable: 'Table',
      background: 'Background',
      undo: 'Undo',
      redo: 'Redo',
      recording: 'Recording...',
      stopRecording: 'Stop',
      playRecording: 'Play Recording',
      saveRecording: 'Save Recording',
      deleteRecording: 'Delete',
      camera: 'Camera',
      color: 'Color',
      size: 'Size',
      thickness: 'Thickness',
      textTitle: 'Title',
      textBody: 'Body',
      fromGallery: 'From Gallery',
      rotation: 'Rotation',
      emojiSize: 'Emoji Size',
      deleteEmoji: 'Delete Emoji',
      noBackground: 'No Background',
      solidColor: 'Solid Color',
      wordMapping: 'Map Words',
      play: 'Play',
      startRecording: 'Record',
    },

    settings: {
      title: 'Settings',
      selectTheme: 'Select Theme',
      selectLanguage: 'Select Language',
      restartRequired: 'Restart Required',
      restartMessage: 'Please restart the app for the layout change to take effect.',
      ok: 'OK',
    },

    about: {
      title: 'About',
    },

    albumCard: {
      menuRename: 'Rename',
      menuDelete: 'Delete',
      menuCancel: 'Cancel',
    },

    themes: {
      girly: 'Girly',
      boyish: 'Boyish',
      solid: 'Solid',
      sparkly: 'Sparkly',
    },

    background: {
      title: 'Background Settings',
      solidColors: 'Solid Colors',
      patterns: 'Patterns',
      image: 'Image',
      selectImage: 'Select Image',
      removeBackground: 'Remove Background',
    },

    audioWordMapping: {
      title: 'Word Mapping',
      instructions: 'Tap a word to mark its time in the recording',
      save: 'Save',
    },

    camera: {
      takePhoto: 'Take Photo',
    },

    imageSearch: {
      title: 'Search Image',
      search: 'Search',
      searchPlaceholder: 'Enter search term...',
      noResults: 'No results found',
    },

    export: {
      share: 'Share',
      exportAsAlbum: 'Export as Album (ZIP)',
      exportAsPDF: 'Export as PDF',
      exportingAlbum: 'Exporting album...',
      exportingPDF: 'Generating PDF...',
      exportComplete: 'Export complete',
      exportFailed: 'Export failed',
      generatingPDF: 'Generating PDF',
      capturingPages: 'Capturing pages',
    },

    import: {
      importAlbum: 'Import Album',
      importingAlbum: 'Importing album...',
      importComplete: 'Import complete',
      importFailed: 'Import failed',
      invalidZipFile: 'Invalid ZIP file',
      albumAlreadyExists: 'An album with this name already exists',
      renameAlbum: 'Rename',
      replaceAlbum: 'Replace',
      enterNewName: 'Enter new name:',
    },

    backup: {
      title: 'Backup & Restore',
      backupAllAlbums: 'Backup All Albums',
      restoreFromBackup: 'Restore from Backup',
      backupInProgress: 'Backing up...',
      backupComplete: 'Backup complete',
      restoreInProgress: 'Restoring...',
      restoreComplete: 'Restore complete',
      albumsImported: 'Albums imported',
      albumsSkipped: 'Albums skipped',
      backupFailed: 'Backup failed',
      restoreFailed: 'Restore failed',
      noAlbumsToBackup: 'No albums to backup',
    },
  },

  ar: {
    home: {
      title: 'ألبوماتي',
      loading: 'جاري تحميل الألبومات...',
      empty: 'لا توجد ألبومات بعد. اضغط + لإنشاء ألبومك الأول!',
      newAlbum: 'ألبوم جديد',
      newAlbumPrompt: 'ألبوم جديد',
      albumNamePlaceholder: 'اسم الألبوم',
      cancel: 'إلغاء',
      create: 'إنشاء',
      error: 'خطأ',
      errorLoadAlbums: 'فشل تحميل الألبومات',
      errorEnterName: 'الرجاء إدخال اسم الألبوم',
      errorCreateAlbum: 'فشل إنشاء الألبوم',
      errorDeleteAlbum: 'فشل حذف الألبوم',
      errorRenameAlbum: 'فشل إعادة تسمية الألبوم',
      deleteAlbumTitle: 'حذف الألبوم',
      deleteAlbumMessage: 'حذف "{name}"؟ لا يمكن التراجع عن هذا.',
      delete: 'حذف',
      renameAlbumTitle: 'إعادة تسمية الألبوم',
      renameAlbumPrompt: 'أدخل اسمًا جديدًا:',
      rename: 'إعادة تسمية',
    },

    album: {
      edit: 'تعديل',
      done: 'تم',
      noPages: 'لا توجد صفحات في الألبوم',
      errorLoadPages: 'فشل تحميل الصفحات',
      errorSavePage: 'فشل حفظ الصفحة',
      errorCreatePage: 'فشل إنشاء الصفحة',
      errorDeletePage: 'فشل حذف الصفحة',
      deletePageTitle: 'حذف الصفحة',
      deletePageMessage: 'حذف هذه الصفحة؟ لا يمكن التراجع عن هذا.',
      creatingPage: 'جاري إنشاء الصفحة...',
      deletingPage: 'جاري حذف الصفحة...',
    },

    editor: {
      page: 'صفحة',
      permissions: 'الأذونات',
      permissionsMessage: 'يرجى السماح بأذونات التسجيل وتخزين الملفات',
      errorRecording: 'فشل التسجيل',
      errorStopRecording: 'فشل إيقاف التسجيل',
      errorPlayRecording: 'فشل تشغيل التسجيل',
      errorSaveRecording: 'فشل حفظ التسجيل',
      errorSaveImage: 'فشل حفظ الصورة',
      sketchPen: 'قلم',
      emoji: 'إيموجي',
      textInput: 'نص',
      addImage: 'صورة',
      addAudio: 'تسجيل',
      addLine: 'خط',
      addTable: 'جدول',
      background: 'خلفية',
      undo: 'تراجع',
      redo: 'إعادة',
      recording: 'جاري التسجيل...',
      stopRecording: 'إيقاف التسجيل',
      playRecording: 'تشغيل التسجيل',
      saveRecording: 'حفظ التسجيل',
      deleteRecording: 'حذف التسجيل',
      camera: 'كاميرا',
      color: 'لون',
      size: 'حجم',
      thickness: 'السمك',
      textTitle: 'عنوان',
      textBody: 'نص',
      fromGallery: 'من المعرض',
      rotation: 'دوران',
      emojiSize: 'حجم الإيموجي',
      deleteEmoji: 'حذف الإيموجي',
      noBackground: 'بدون خلفية',
      solidColor: 'لون صلب',
      wordMapping: 'تخطيط الكلمات',
      play: 'تشغيل',
      startRecording: 'بدء التسجيل',
    },

    settings: {
      title: 'الإعدادات',
      selectTheme: 'اختر السمة',
      selectLanguage: 'اختر اللغة',
      restartRequired: 'مطلوب إعادة التشغيل',
      restartMessage: 'يرجى إعادة تشغيل التطبيق لتطبيق التغيير.',
      ok: 'موافق',
    },

    about: {
      title: 'حول',
    },

    albumCard: {
      menuRename: 'إعادة تسمية',
      menuDelete: 'حذف',
      menuCancel: 'إلغاء',
    },

    themes: {
      girly: 'بناتي',
      boyish: 'أولادي',
      solid: 'كلاسيكي',
      sparkly: 'لامع',
    },

    background: {
      title: 'إعدادات الخلفية',
      solidColors: 'ألوان صلبة',
      patterns: 'أنماط',
      image: 'صورة',
      selectImage: 'اختر صورة',
      removeBackground: 'إزالة الخلفية',
    },

    audioWordMapping: {
      title: 'تخطيط الكلمات',
      instructions: 'انقر على كلمة لتحديد وقتها في التسجيل',
      save: 'حفظ',
    },

    camera: {
      takePhoto: 'التقط صورة',
    },

    imageSearch: {
      title: 'بحث عن صورة',
      search: 'بحث',
      searchPlaceholder: 'أدخل كلمة البحث...',
      noResults: 'لم يتم العثور على نتائج',
    },

    export: {
      share: 'مشاركة',
      exportAsAlbum: 'تصدير كألبوم (ZIP)',
      exportAsPDF: 'تصدير كـ PDF',
      exportingAlbum: 'جاري تصدير الألبوم...',
      exportingPDF: 'جاري إنشاء PDF...',
      exportComplete: 'اكتمل التصدير',
      exportFailed: 'فشل التصدير',
      generatingPDF: 'إنشاء PDF',
      capturingPages: 'التقاط الصفحات',
    },

    import: {
      importAlbum: 'استيراد ألبوم',
      importingAlbum: 'جاري استيراد الألبوم...',
      importComplete: 'اكتمل الاستيراد',
      importFailed: 'فشل الاستيراد',
      invalidZipFile: 'ملف ZIP غير صالح',
      albumAlreadyExists: 'يوجد ألبوم بهذا الاسم بالفعل',
      renameAlbum: 'إعادة تسمية',
      replaceAlbum: 'استبدال',
      enterNewName: 'أدخل اسمًا جديدًا:',
    },

    backup: {
      title: 'النسخ الاحتياطي والاستعادة',
      backupAllAlbums: 'نسخ احتياطي لجميع الألبومات',
      restoreFromBackup: 'استعادة من النسخ الاحتياطي',
      backupInProgress: 'جاري النسخ الاحتياطي...',
      backupComplete: 'اكتمل النسخ الاحتياطي',
      restoreInProgress: 'جاري الاستعادة...',
      restoreComplete: 'اكتملت الاستعادة',
      albumsImported: 'الألبومات المستوردة',
      albumsSkipped: 'الألبومات المتخطاة',
      backupFailed: 'فشل النسخ الاحتياطي',
      restoreFailed: 'فشلت الاستعادة',
      noAlbumsToBackup: 'لا توجد ألبومات للنسخ الاحتياطي',
    },
  },
};

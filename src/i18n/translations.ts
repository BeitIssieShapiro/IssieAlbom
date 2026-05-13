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
    errorNameEmpty: string;
    errorNameTooLong: string;
    errorNameInvalidChars: string;
    errorNameReserved: string;
    errorNameDuplicate: string;
    deleteAlbumTitle: string;
    deleteAlbumMessage: string;
    delete: string;
    renameAlbumTitle: string;
    renameAlbumPrompt: string;
    rename: string;
    portrait: string;
    landscape: string;
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
    of: string;
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
    selectEmoji: string;
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
    tilesTitle: string;
    tilesPrompt: string;
    tilesPlaceholder: string;
    tilesBackgroundColor: string;
    tilesTextColor: string;
    tilesMerge: string;
    tilesUnmerge: string;
    tilesCreate: string;
    tilesUpdate: string;
    tilesSelectAll: string;
    tilesDeselectAll: string;
    tilesAddEmoji: string;
    tilesAddSymbol: string;
    tilesDeleteSymbol: string;
    tilesEditText: string;
    tilesDelete: string;
    tilesExistCannotAddTitle: string;
    titleExistsCannotAddTiles: string;
    fromGallery: string;
    rotation: string;
    emojiSize: string;
    deleteEmoji: string;
    noBackground: string;
    solidColor: string;
    wordMapping: string;
    play: string;
    startRecording: string;
    editImage: string;
    deleteImage: string;
    deleteImageConfirm: string;
    deleteTitleConfirm: string;
    deleteTilesConfirm: string;
    deleteAudioConfirm: string;
    deleteElementConfirm: string;
    multipleImagesSelected: string;
    addToCurrentPage: string;
    createNewPages: string;
    multipleImagesPrompt: string;
    searchingSymbols: string;
    findingSymbols: string;
  };

  // Settings Screen
  settings: {
    title: string;
    selectTheme: string;
    selectLanguage: string;
    restartRequired: string;
    restartMessage: string;
    ok: string;
    feedback: string;
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

  // Symbol Search
  symbolSearch: {
    title: string;
    placeholder: string;
    searching: string;
    noResults: string;
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

  // Image Edit Modal
  imageEdit: {
    title: string;
    cancel: string;
    apply: string;
    reset: string;
    instructions: string;
    error: string;
    errorCapture: string;
    errorSave: string;
  };

  // Export/Import
  export: {
    share: string;
    exportAsAlbum: string;
    exportAsAlbumDesc: string;
    exportAsPDF: string;
    exportAsPDFDesc: string;
    exportAsVideo: string;
    exportAsVideoDesc: string;
    exportingAlbum: string;
    exportingPDF: string;
    exportingVideo: string;
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
      errorNameEmpty: 'נא להזין שם לאלבום',
      errorNameTooLong: 'השם ארוך מדי (מקסימום 255 תווים)',
      errorNameInvalidChars: 'השם מכיל תווים לא חוקיים: / \\ : * ? " < > |',
      errorNameReserved: 'השם הזה שמור ואינו ניתן לשימוש',
      errorNameDuplicate: 'אלבום עם שם זה כבר קיים',
      deleteAlbumTitle: 'מחיקת אלבום',
      deleteAlbumMessage: 'האם למחוק את "{name}"? לא ניתן לבטל פעולה זו.',
      delete: 'מחיקה',
      renameAlbumTitle: 'שינוי שם אלבום',
      renameAlbumPrompt: 'הזן שם חדש:',
      rename: 'שינוי שם',
      portrait: 'לאורך',
      landscape: 'לרוחב',
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
      of: 'מתוך',
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
      selectEmoji: 'בחר אימוג\'י',
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
      tilesTitle: 'כותרת תאים',
      tilesPrompt: 'הזן טקסט לכותרת',
      tilesPlaceholder: 'טקסט הכותרת...',
      tilesBackgroundColor: 'צבע רקע תא',
      tilesTextColor: 'צבע טקסט',
      tilesMerge: 'מזג תאים',
      tilesUnmerge: 'בטל מיזוג',
      tilesCreate: 'צור תאים',
      tilesUpdate: 'עדכן תאים',
      tilesSelectAll: 'בחר הכל',
      tilesDeselectAll: 'בטל בחירה',
      tilesAddEmoji: 'הוסף אמוג׳י',
      tilesAddSymbol: 'הוסף סמל',
      tilesDeleteSymbol: 'מחק סמל',
      tilesEditText: 'ערוך טקסט',
      tilesDelete: 'מחק תאים',
      tilesExistCannotAddTitle: 'כבר יש תאים בעמוד. מחק את התאים קודם כדי להוסיף כותרת.',
      titleExistsCannotAddTiles: 'כבר יש כותרת בעמוד. מחק את הכותרת קודם כדי להוסיף תאים.',
      fromGallery: 'מגלריה',
      rotation: 'סיבוב',
      emojiSize: 'גודל אימוג\'י',
      deleteEmoji: 'מחק אימוג\'י',
      noBackground: 'ללא רקע',
      solidColor: 'צבע אחיד',
      wordMapping: 'מיפוי מילים',
      play: 'השמע',
      startRecording: 'התחל הקלטה',
      editImage: 'ערוך תמונה',
      deleteImage: 'מחק תמונה',
      deleteImageConfirm: 'האם למחוק את התמונה?',
      deleteTitleConfirm: 'האם למחוק את הכותרת?',
      deleteTilesConfirm: 'האם למחוק את התאים?',
      deleteAudioConfirm: 'האם למחוק את ההקלטה?',
      deleteElementConfirm: 'האם למחוק אלמנט זה?',
      multipleImagesSelected: 'נבחרו {count} תמונות',
      addToCurrentPage: 'הוסף לעמוד נוכחי',
      createNewPages: 'צור עמודים חדשים',
      multipleImagesPrompt: 'האם להוסיף את כל התמונות לעמוד הנוכחי או ליצור עמוד חדש לכל תמונה?',
      searchingSymbols: 'מחפש סמלים...',
      findingSymbols: 'מחפש סמלים למילים...',
    },

    settings: {
      title: 'הגדרות',
      selectTheme: 'בחר ערכת נושא',
      selectLanguage: 'בחר שפה',
      restartRequired: 'נדרש אתחול',
      restartMessage: 'יש להפעיל מחדש את האפליקציה כדי שהשינוי ייכנס לתוקף.',
      ok: 'אישור',
      feedback: 'שלח משוב',
    },

    about: {
      title: 'אודות',
    },

    albumCard: {
      menuRename: 'שינוי שם',
      menuDelete: 'מחיקה',
      menuCancel: 'ביטול',
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

    symbolSearch: {
      title: 'חיפוש סמלים',
      placeholder: 'חפש סמל...',
      searching: 'מחפש...',
      noResults: 'לא נמצאו סמלים',
    },

    camera: {
      takePhoto: 'צלם תמונה',
    },

    imageSearch: {
      title: 'חיפוש סמל',
      search: 'חיפוש',
      searchPlaceholder: 'הקלד מילת חיפוש...',
      noResults: 'לא נמצאו תוצאות',
    },

    imageEdit: {
      title: 'עריכת תמונה',
      cancel: 'ביטול',
      apply: 'אישור',
      reset: 'איפוס',
      instructions: 'יש להשתמש בשתי אצבעות כדי לזוז, לסובב ולהגדיל',
      error: 'שגיאה',
      errorCapture: 'לא ניתן לצלם את התמונה',
      errorSave: 'לא ניתן לשמור את התמונה',
    },

    export: {
      share: 'שיתוף',
      exportAsAlbum: 'ייצוא כאלבום (ZIP)',
      exportAsAlbumDesc: 'גיבוי מלא עם כל התוכן',
      exportAsPDF: 'ייצוא כ-PDF',
      exportAsPDFDesc: 'להדפסה או לצפייה',
      exportAsVideo: 'ייצוא כסרטון (MP4)',
      exportAsVideoDesc: 'סרטון עם אודיו מסונכרן',
      exportingAlbum: 'מייצא אלבום...',
      exportingPDF: 'מייצר PDF...',
      exportingVideo: 'מייצר סרטון...',
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
      errorNameEmpty: 'Please enter an album name',
      errorNameTooLong: 'Name is too long (maximum 255 characters)',
      errorNameInvalidChars: 'Name contains invalid characters: / \\ : * ? " < > |',
      errorNameReserved: 'This name is reserved and cannot be used',
      errorNameDuplicate: 'An album with this name already exists',
      deleteAlbumTitle: 'Delete Album',
      deleteAlbumMessage: 'Delete "{name}"? This cannot be undone.',
      delete: 'Delete',
      renameAlbumTitle: 'Rename Album',
      renameAlbumPrompt: 'Enter new name:',
      rename: 'Rename',
      portrait: 'Portrait',
      landscape: 'Landscape',
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
      of: 'of',
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
      selectEmoji: 'Select Emoji',
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
      tilesTitle: 'Cells Title',
      tilesPrompt: 'Enter title text',
      tilesPlaceholder: 'Title text...',
      tilesBackgroundColor: 'Cell Background Color',
      tilesTextColor: 'Text Color',
      tilesMerge: 'Merge Cells',
      tilesUnmerge: 'Unmerge',
      tilesCreate: 'Create Cells',
      tilesUpdate: 'Update Cells',
      tilesSelectAll: 'Select All',
      tilesDeselectAll: 'Deselect All',
      tilesAddEmoji: 'Add Emoji',
      tilesAddSymbol: 'Add Symbol',
      tilesDeleteSymbol: 'Delete Symbol',
      tilesEditText: 'Edit Text',
      tilesDelete: 'Delete Cells',
      tilesExistCannotAddTitle: 'This page already has cells. Delete the cells first to add a title.',
      titleExistsCannotAddTiles: 'This page already has a title. Delete the title first to add cells.',
      fromGallery: 'From Gallery',
      rotation: 'Rotation',
      emojiSize: 'Emoji Size',
      deleteEmoji: 'Delete Emoji',
      noBackground: 'No Background',
      solidColor: 'Solid Color',
      wordMapping: 'Map Words',
      play: 'Play',
      startRecording: 'Record',
      editImage: 'Edit Image',
      deleteImage: 'Delete Image',
      deleteImageConfirm: 'Delete this image?',
      deleteTitleConfirm: 'Delete the title?',
      deleteTilesConfirm: 'Delete the cells?',
      deleteAudioConfirm: 'Delete the recording?',
      deleteElementConfirm: 'Delete this element?',
      multipleImagesSelected: '{count} images selected',
      addToCurrentPage: 'Add to Current Page',
      createNewPages: 'Create New Pages',
      multipleImagesPrompt: 'Add all images to current page or create a new page for each image?',
      searchingSymbols: 'Searching for symbols...',
      findingSymbols: 'Finding symbols for words...',
    },

    settings: {
      title: 'Settings',
      selectTheme: 'Select Theme',
      selectLanguage: 'Select Language',
      restartRequired: 'Restart Required',
      restartMessage: 'Please restart the app for the layout change to take effect.',
      ok: 'OK',
      feedback: 'Send Feedback',
    },

    about: {
      title: 'About',
    },

    albumCard: {
      menuRename: 'Rename',
      menuDelete: 'Delete',
      menuCancel: 'Cancel',
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

    symbolSearch: {
      title: 'Symbol Search',
      placeholder: 'Search for a symbol...',
      searching: 'Searching...',
      noResults: 'No symbols found',
    },

    camera: {
      takePhoto: 'Take Photo',
    },

    imageSearch: {
      title: 'Symbol Search',
      search: 'Search',
      searchPlaceholder: 'Enter search term...',
      noResults: 'No results found',
    },

    imageEdit: {
      title: 'Edit Image',
      cancel: 'Cancel',
      apply: 'Apply',
      reset: 'Reset',
      instructions: 'Use two fingers to move, rotate, and zoom',
      error: 'Error',
      errorCapture: 'Cannot capture the image',
      errorSave: 'Cannot save the image',
    },

    export: {
      share: 'Share',
      exportAsAlbum: 'Export as Album (ZIP)',
      exportAsAlbumDesc: 'Full backup with all content',
      exportAsPDF: 'Export as PDF',
      exportAsPDFDesc: 'For printing or viewing',
      exportAsVideo: 'Export as Video (MP4)',
      exportAsVideoDesc: 'Video with synchronized audio',
      exportingAlbum: 'Exporting album...',
      exportingPDF: 'Generating PDF...',
      exportingVideo: 'Generating video...',
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
      errorNameEmpty: 'الرجاء إدخال اسم الألبوم',
      errorNameTooLong: 'الاسم طويل جدًا (الحد الأقصى 255 حرفًا)',
      errorNameInvalidChars: 'الاسم يحتوي على أحرف غير صالحة: / \\ : * ? " < > |',
      errorNameReserved: 'هذا الاسم محجوز ولا يمكن استخدامه',
      errorNameDuplicate: 'يوجد ألبوم بهذا الاسم بالفعل',
      deleteAlbumTitle: 'حذف الألبوم',
      deleteAlbumMessage: 'حذف "{name}"؟ لا يمكن التراجع عن هذا.',
      delete: 'حذف',
      renameAlbumTitle: 'إعادة تسمية الألبوم',
      renameAlbumPrompt: 'أدخل اسمًا جديدًا:',
      rename: 'إعادة تسمية',
      portrait: 'عمودي',
      landscape: 'أفقي',
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
      of: 'من',
      permissions: 'الأذونات',
      permissionsMessage: 'يرجى السماح بأذونات التسجيل وتخزين الملفات',
      errorRecording: 'فشل التسجيل',
      errorStopRecording: 'فشل إيقاف التسجيل',
      errorPlayRecording: 'فشل تشغيل التسجيل',
      errorSaveRecording: 'فشل حفظ التسجيل',
      errorSaveImage: 'فشل حفظ الصورة',
      sketchPen: 'قلم',
      pen: 'قلم',
      emoji: 'إيموجي',
      emojis: 'إيموجيات',
      selectEmoji: 'اختر إيموجي',
      textInput: 'نص',
      addImage: 'صورة',
      addAudio: 'تسجيل',
      audio: 'صوت',
      addLine: 'خط',
      addTable: 'جدول',
      background: 'خلفية',
      undo: 'تراجع',
      redo: 'إعادة',
      recording: 'جاري التسجيل...',
      stopRecording: 'إيقاف',
      playRecording: 'تشغيل التسجيل',
      saveRecording: 'حفظ التسجيل',
      deleteRecording: 'حذف',
      camera: 'كاميرا',
      color: 'لون',
      size: 'حجم',
      thickness: 'السمك',
      textTitle: 'عنوان',
      textBody: 'نص',
      tilesTitle: 'عنوان الخلايا',
      tilesPrompt: 'أدخل نص العنوان',
      tilesPlaceholder: 'نص العنوان...',
      tilesBackgroundColor: 'لون خلفية الخلية',
      tilesTextColor: 'لون النص',
      tilesMerge: 'دمج الخلايا',
      tilesUnmerge: 'إلغاء الدمج',
      tilesCreate: 'إنشاء الخلايا',
      tilesUpdate: 'تحديث الخلايا',
      tilesSelectAll: 'تحديد الكل',
      tilesDeselectAll: 'إلغاء التحديد',
      tilesAddEmoji: 'إضافة رمز',
      tilesAddSymbol: 'إضافة رمز بياني',
      tilesDeleteSymbol: 'حذف الرمز',
      tilesEditText: 'تعديل النص',
      tilesDelete: 'حذف الخلايا',
      tilesExistCannotAddTitle: 'توجد خلايا بالفعل في هذه الصفحة. احذف الخلايا أولاً لإضافة عنوان.',
      titleExistsCannotAddTiles: 'يوجد عنوان بالفعل في هذه الصفحة. احذف العنوان أولاً لإضافة خلايا.',
      fromGallery: 'من المعرض',
      rotation: 'دوران',
      emojiSize: 'حجم الإيموجي',
      deleteEmoji: 'حذف الإيموجي',
      noBackground: 'بدون خلفية',
      solidColor: 'لون صلب',
      wordMapping: 'تخطيط الكلمات',
      play: 'تشغيل',
      startRecording: 'تسجيل',
      editImage: 'تحرير الصورة',
      deleteImage: 'حذف الصورة',
      deleteImageConfirm: 'هل تريد حذف هذه الصورة?',
      deleteTitleConfirm: 'هل تريد حذف العنوان؟',
      deleteTilesConfirm: 'هل تريد حذف الخلايا؟',
      deleteAudioConfirm: 'هل تريد حذف التسجيل؟',
      deleteElementConfirm: 'هل تريد حذف هذا العنصر؟',
      multipleImagesSelected: 'تم تحديد {count} صور',
      addToCurrentPage: 'أضف إلى الصفحة الحالية',
      createNewPages: 'إنشاء صفحات جديدة',
      multipleImagesPrompt: 'هل تريد إضافة جميع الصور إلى الصفحة الحالية أو إنشاء صفحة جديدة لكل صورة؟',
    },

    settings: {
      title: 'الإعدادات',
      selectTheme: 'اختر السمة',
      selectLanguage: 'اختر اللغة',
      restartRequired: 'مطلوب إعادة التشغيل',
      restartMessage: 'يرجى إعادة تشغيل التطبيق لتطبيق التغيير.',
      ok: 'موافق',
      feedback: 'إرسال ملاحظات',
    },

    about: {
      title: 'حول',
    },

    albumCard: {
      menuRename: 'إعادة تسمية',
      menuDelete: 'حذف',
      menuCancel: 'إلغاء',
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
      title: 'بحث عن رمز',
      search: 'بحث',
      searchPlaceholder: 'أدخل كلمة البحث...',
      noResults: 'لم يتم العثور على نتائج',
    },

    imageEdit: {
      title: 'تحرير الصورة',
      cancel: 'إلغاء',
      apply: 'تطبيق',
      reset: 'إعادة تعيين',
      instructions: 'استخدم إصبعين للتحريك والتدوير والتكبير',
      error: 'خطأ',
      errorCapture: 'لا يمكن التقاط الصورة',
      errorSave: 'لا يمكن حفظ الصورة',
    },

    export: {
      share: 'مشاركة',
      exportAsAlbum: 'تصدير كألبوم (ZIP)',
      exportAsAlbumDesc: 'نسخة احتياطية كاملة مع كل المحتوى',
      exportAsPDF: 'تصدير كـ PDF',
      exportAsPDFDesc: 'للطباعة أو العرض',
      exportAsVideo: 'تصدير كفيديو (MP4)',
      exportAsVideoDesc: 'فيديو مع صوت متزامن',
      exportingAlbum: 'جاري تصدير الألبوم...',
      exportingPDF: 'جاري إنشاء PDF...',
      exportingVideo: 'جاري إنشاء الفيديو...',
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

import fs from 'node:fs';
import path from 'node:path';

const SOURCE = path.resolve(process.argv[2] || 'tmp_import/10000_questions_he.jsonl');
const TARGET = path.resolve(process.argv[3] || 'src/data/questions.json');

const locales = ['en', 'ar', 'ru', 'am'];
const correctIndexByLetter = new Map([
  ['א', 0],
  ['ב', 1],
  ['ג', 2],
  ['ד', 3]
]);

const categoryTranslations = {
  'גאוגרפיה': {
    en: 'Geography',
    ar: 'الجغرافيا',
    ru: 'География',
    am: 'ጂኦግራፊ'
  },
  'היסטוריה': {
    en: 'History',
    ar: 'التاريخ',
    ru: 'История',
    am: 'ታሪክ'
  },
  'מדע': {
    en: 'Science',
    ar: 'العلوم',
    ru: 'Наука',
    am: 'ሳይንስ'
  },
  'רפואה': {
    en: 'Medicine',
    ar: 'الطب',
    ru: 'Медицина',
    am: 'ሕክምና'
  },
  'טכנולוגיה': {
    en: 'Technology',
    ar: 'التكنولوجيا',
    ru: 'Технологии',
    am: 'ቴክኖሎጂ'
  },
  'פוליטיקה': {
    en: 'Politics',
    ar: 'السياسة',
    ru: 'Политика',
    am: 'ፖለቲካ'
  },
  'טיקטוק': {
    en: 'TikTok',
    ar: 'تيك توك',
    ru: 'TikTok',
    am: 'TikTok'
  },
  'רכילות ותרבות ישראלית': {
    en: 'Israeli Celebrity and Culture',
    ar: 'مشاهير وثقافة إسرائيلية',
    ru: 'Израильские знаменитости и культура',
    am: 'የእስራኤል ዝነኞችና ባህል'
  },
  'רכילות ותרבות אמריקאית ועולמית': {
    en: 'Global Celebrity and Pop Culture',
    ar: 'مشاهير وثقافة عالمية',
    ru: 'Мировые знаменитости и поп-культура',
    am: 'ዓለም አቀፍ ዝነኞችና ፖፕ ባህል'
  },
  'ידע כללי': {
    en: 'General Knowledge',
    ar: 'معرفة عامة',
    ru: 'Общие знания',
    am: 'አጠቃላይ እውቀት'
  }
};

const difficultyTranslations = {
  'קל': { en: 'Easy', ar: 'سهل', ru: 'Легкий', am: 'ቀላል' },
  'בינוני': { en: 'Medium', ar: 'متوسط', ru: 'Средний', am: 'መካከለኛ' },
  'קשה': { en: 'Hard', ar: 'صعب', ru: 'Сложный', am: 'ከባድ' },
  'מומחה': { en: 'Expert', ar: 'خبير', ru: 'Эксперт', am: 'ባለሙያ' }
};

const termEn = {
  '1,500 ק"מ לשנייה': '1,500 km per second',
  '3,000 ק"מ לשנייה': '3,000 km per second',
  '30,000 ק"מ לשנייה': '30,000 km per second',
  '300,000 ק"מ לשנייה': '300,000 km per second',
  '27 לפנה"ס': '27 BCE',
  '44 לפנה"ס': '44 BCE',
  '476 לספירה': '476 CE',
  '800 לספירה': '800 CE',
  'RNA בלבד': 'RNA only',
  'אבו דאבי': 'Abu Dhabi',
  "אבוג'ה": 'Abuja',
  'אבחון רפואי': 'medical diagnosis',
  'אגרוף': 'boxing',
  'אדום': 'red',
  'אדיס אבבה': 'Addis Ababa',
  'אדריכלות': 'architecture',
  'אדריכלות צבאית': 'military architecture',
  'אדרנלין': 'adrenaline',
  'אוורסט': 'Everest',
  'אוטווה': 'Ottawa',
  'אולימפוס': 'Olympus',
  'אוסטרליה': 'Australia',
  'אוסלו': 'Oslo',
  'אוסמוזה': 'osmosis',
  'אורתופד': 'orthopedist',
  'אחסון מזון': 'food storage',
  'אטקמה': 'Atacama',
  'איזון ובקרה בין מוקדי כוח שלטוניים': 'checks and balances between branches of government',
  'איטליה': 'Italy',
  'אימון טיסה': 'flight training',
  'אין בחירות כלל': 'no elections at all',
  'אינסולין': 'insulin',
  'איסלנד': 'Iceland',
  'אירופה': 'Europe',
  'אלברוס': 'Elbrus',
  "אלג'יר": 'Algiers',
  'אליפות שחמט': 'chess championship',
  'אלסה': 'Elsa',
  'אלקטרון': 'electron',
  'אמסטרדם': 'Amsterdam',
  'אמריקה הדרומית': 'South America',
  'אנטארקטיקה': 'Antarctica',
  'אנקרה': 'Ankara',
  'אסטרונאוטית': 'astronaut',
  'אסלאמאבאד': 'Islamabad',
  'אקרה': 'Accra',
  'ארגון': 'argon',
  'ארגון בינלאומי בין מדינות': 'an international organization of states',
  'ארגנטינה': 'Argentina',
  'ארץ': 'Earth',
  'אתונה': 'Athens',
  'בדיקת דם': 'blood test',
  'בואנוס איירס': 'Buenos Aires',
  'בוגוטה': 'Bogota',
  'בודפשט': 'Budapest',
  'בוקרשט': 'Bucharest',
  'בורנאו': 'Borneo',
  'בחירת שופטים בהגרלה': 'choosing judges by lottery',
  'בחירת שירי אירוויזיון': 'selecting Eurovision songs',
  'ביטוח רכב': 'car insurance',
  "בייג'ינג": 'Beijing',
  'ביירות': 'Beirut',
  'בית המחוקקים של ישראל': 'Israel’s legislature',
  'בית משפט בינלאומי': 'international court',
  'בית ספר': 'school',
  'בלגרד': 'Belgrade',
  'בלשנות': 'linguistics',
  'בנגקוק': 'Bangkok',
  'בנק מרכזי': 'central bank',
  'ברזיליה': 'Brasília',
  'ברזל': 'iron',
  'בריסל': 'Brussels',
  'ברית מפלגות התומכת בממשלה': 'a coalition of parties supporting the government',
  'ברלין': 'Berlin',
  'ברן': 'Bern',
  'גאוגרפיה': 'geography',
  'גובי': 'Gobi',
  "ג'ול": 'joule',
  "ג'יימס קמרון": 'James Cameron',
  'גלוקוז': 'glucose',
  "ג'קרטה": 'Jakarta',
  'גרינלנד': 'Greenland',
  'דאקה': 'Dhaka',
  'דבלין': 'Dublin',
  'דוחה': 'Doha',
  'דחיסת אוויר': 'air compression',
  'דיון סגור בלבד': 'closed discussion only',
  'דקר': 'Dakar',
  'דרמה ומתח': 'drama and suspense',
  'האוקיינוס האטלנטי': 'Atlantic Ocean',
  'האוקיינוס הארקטי': 'Arctic Ocean',
  'האוקיינוס ההודי': 'Indian Ocean',
  'האוקיינוס השקט': 'Pacific Ocean',
  'האזרחים בוחרים נציגים לקבלת החלטות': 'citizens elect representatives to make decisions',
  'האמזונאס': 'Amazon River',
  'האנוי': 'Hanoi',
  'הגדלת זיכרון RAM': 'increasing RAM',
  'הגדלת נפח אחסון פיזי': 'increasing physical storage capacity',
  'הגדלת נפח ריאה': 'increasing lung volume',
  'הגדלת תיירות': 'increasing tourism',
  'הגרלה ארצית': 'national lottery',
  'הדנובה': 'Danube River',
  'הדפסת דרכון': 'printing a passport',
  'הדפסת כסף': 'printing money',
  'הדפסת נייר': 'printing paper',
  'הדפסת תלת-ממד': '3D printing',
  'הדפסת תמונה': 'printing a photo',
  'החלפת כל חומרה במחשב': 'replacing every computer component',
  'החלפת כרטיס SIM': 'replacing a SIM card',
  'החלפת שפה רשמית': 'changing an official language',
  'הים הכספי': 'Caspian Sea',
  'הים השחור': 'Black Sea',
  'הכוחות הפוליטיים שאינם חלק מהממשלה': 'political forces outside the government',
  'הליום': 'helium',
  'הלסינקי': 'Helsinki',
  'המאה ה-12': '12th century',
  'המאה ה-15': '15th century',
  'המאה ה-17': '17th century',
  'המאה ה-19': '19th century',
  'המוגלובין': 'hemoglobin',
  'המוזיקה': 'music',
  'המלצות סרטונים מותאמות למשתמש': 'personalized video recommendations',
  'המקונג': 'Mekong River',
  'המרת מטבע': 'currency conversion',
  'הנילוס': 'Nile River',
  'הפיכת מים לחשמל': 'turning water into electricity',
  'הפקת קול': 'sound production',
  'הצבא מחוקק חוקים': 'the army legislates laws',
  'הצבעה בכנסת': 'a vote in the Knesset',
  'הצבעה ישירה של הציבור בנושא מסוים': 'a direct public vote on a specific issue',
  'הצפנת דיסקים': 'disk encryption',
  'הקולנוע': 'cinema',
  'הקלטת קול בלבד': 'audio recording only',
  "הרמיוני גריינג'ר": 'Hermione Granger',
  'ואט': 'watt',
  'וונדר וומן': 'Wonder Woman',
  'וושינגטון די. סי.': 'Washington, D.C.',
  'ויטמין B12': 'vitamin B12',
  'ויטמין C': 'vitamin C',
  'ויטמין D': 'vitamin D',
  'ויטמין K': 'vitamin K',
  'וינה': 'Vienna',
  'ולינגטון': 'Wellington',
  'ורשה': 'Warsaw',
  'זאגרב': 'Zagreb',
  'זכוכית': 'glass',
  'זמרת-יוצרת אמריקאית': 'American singer-songwriter',
  'חברה מסחרית': 'commercial company',
  'חברת משחקים': 'gaming company',
  'חיבור בין מותגים ליוצרי תוכן': 'connecting brands with content creators',
  'חיבור לחשמל': 'connecting to electricity',
  'חיבור למסך': 'connecting to a screen',
  'חימום מים': 'heating water',
  'חליל': 'flute',
  'חמצן': 'oxygen',
  'חנקן': 'nitrogen',
  'חצוצרה': 'trumpet',
  'חקלאות': 'agriculture',
  'טוקיו': 'Tokyo',
  'טחול': 'spleen',
  'טלנובלה מקסיקנית': 'Mexican telenovela',
  'טניס': 'tennis',
  'טעינת סוללה': 'charging a battery',
  'יוון': 'Greece',
  'יחידת מדידה': 'unit of measurement',
  'ייצור חשמל': 'electricity generation',
  'ייצור נעליים': 'shoe manufacturing',
  'ים המלח': 'Dead Sea',
  'ימת ויקטוריה': 'Lake Victoria',
  'יפן': 'Japan',
  'יצירת סרטון לצד סרטון קיים': 'creating a video alongside an existing video',
  'יצירת תוכן חדש לפי דפוסים שלמדה': 'creating new content from learned patterns',
  'יצירת תרופות': 'creating medicines',
  'ירוק': 'green',
  'ירושלים': 'Jerusalem',
  'ירידה מיידית בחום': 'an immediate drop in fever',
  'יתר לחץ דם': 'hypertension',
  'כבד': 'liver',
  'כוכב חמה': 'Mercury',
  'כוריאוגרפיה שחוזרים עליה משתמשים רבים': 'choreography repeated by many users',
  'כלורופיל': 'chlorophyll',
  'כלי מטבח': 'kitchen utensil',
  'כלי נגינה': 'musical instrument',
  'כליה': 'kidney',
  'כריסטופר נולאן': 'Christopher Nolan',
  'כתום': 'orange',
  'כתיבת חוזים': 'writing contracts',
  'לב': 'heart',
  'לבלב': 'pancreas',
  'ליטר': 'liter',
  'לימה': 'Lima',
  'ליסבון': 'Lisbon',
  'מאדים': 'Mars',
  'מבנה דפי אינטרנט': 'web page structure',
  'מדגסקר': 'Madagascar',
  'מדידת חום': 'measuring temperature',
  'מדידת לחץ דם': 'measuring blood pressure',
  'מדידת מרחק': 'measuring distance',
  'מדידת רעידות אדמה': 'measuring earthquakes',
  'מדריד': 'Madrid',
  'מונטווידאו': 'Montevideo',
  'מוסקבה': 'Moscow',
  'מחיקת חשבון של אחר': 'deleting someone else’s account',
  'מחקר פיזיקה גרעינית': 'nuclear physics research',
  'מטאורולוגיה': 'meteorology',
  'מטבע לאומי': 'national currency',
  'מימן': 'hydrogen',
  'מינוי של האו"ם': 'a United Nations appointment',
  'מיקרוגלים': 'microwaves',
  'מכירת דלק': 'selling fuel',
  'מכשירים ניידים': 'mobile devices',
  'מלטונין': 'melatonin',
  'מנילה': 'Manila',
  'מסגרת עקרונית לחוקי המדינה ולמוסדותיה': 'a basic framework for state laws and institutions',
  'מסחר בבורסה': 'stock exchange trading',
  'מסמך PDF': 'PDF document',
  'מסמך רפואי': 'medical document',
  'מעבד פיזי': 'physical processor',
  'מעלות צלזיוס': 'degrees Celsius',
  'מעליות': 'elevators',
  'מערכת החיסון': 'immune system',
  'מערכת העיכול': 'digestive system',
  'מערכת הפעלה': 'operating system',
  'מערכת הרבייה': 'reproductive system',
  'מערכת השלד': 'skeletal system',
  'מפלגה מקומית': 'local party',
  'מפת מזג אוויר': 'weather map',
  'מקסיקו': 'Mexico',
  'מקסיקו סיטי': 'Mexico City',
  'מרטין סקורסזה': 'Martin Scorsese',
  'משחק קופסה': 'board game',
  'משמר נשיאותי': 'presidential guard',
  'משפטים': 'law',
  'נוגה': 'Venus',
  'נוירולוג': 'neurologist',
  'נחושת': 'copper',
  'ניהול בתי משפט': 'court administration',
  'ניהול גרסאות קוד': 'code version control',
  'ניהול סוללות': 'battery management',
  'ניהול ערוצי טלוויזיה': 'television channel management',
  'ניו דלהי': 'New Delhi',
  'ניווט לווייני בלבד': 'satellite navigation only',
  'ניוטון': 'newton',
  'נייטרון': 'neutron',
  'ניירובי': 'Nairobi',
  'ניקוסיה': 'Nicosia',
  'נפטון': 'Neptune',
  'נשימה תאית': 'cellular respiration',
  'סגול': 'purple',
  'סהרה': 'Sahara',
  'סוג מצלמה בלבד': 'camera type only',
  'סוג משוואה': 'type of equation',
  'סוכרת': 'diabetes',
  'סופיה': 'Sofia',
  'סטוקהולם': 'Stockholm',
  'סטיבן ספילברג': 'Steven Spielberg',
  'סיאול': 'Seoul',
  'סין': 'China',
  'סיפור חייו של אדם': 'the story of a person’s life',
  'סנטיאגו': 'Santiago',
  'ספר בישול': 'cookbook',
  'ספרד': 'Spain',
  'סקי': 'skiing',
  'עיבוד גרפי ומקבילי': 'graphics and parallel processing',
  'עיצוב דפי אינטרנט': 'web page styling',
  'עיתון יומי': 'daily newspaper',
  'עמאן': 'Amman',
  'עריכת גיליונות': 'editing spreadsheets',
  'עריכת תמונות בלבד': 'photo editing only',
  'פוטון': 'photon',
  'פוטוסינתזה': 'photosynthesis',
  'פחמן': 'carbon',
  'פחמן דו-חמצני': 'carbon dioxide',
  'פסנתר': 'piano',
  'פסקל': 'pascal',
  'פראג': 'Prague',
  'פרוטון': 'proton',
  'פרטוריה': 'Pretoria',
  'פריז': 'Paris',
  'פרשנות החוק והכרעה בסכסוכים': 'interpreting the law and resolving disputes',
  'פתרון משוואות': 'solving equations',
  'צדק': 'Jupiter',
  'צילום וידאו': 'video recording',
  'צליאק': 'celiac disease',
  'צרפת': 'France',
  'קביעת תור רפואי': 'scheduling a medical appointment',
  'קהיר': 'Cairo',
  'קואלה לומפור': 'Kuala Lumpur',
  'קולגן': 'collagen',
  'קולומביה': 'Colombia',
  'קופנהגן': 'Copenhagen',
  'קוריאה הדרומית': 'South Korea',
  'קטניס אוורדין': 'Katniss Everdeen',
  'קיבה': 'stomach',
  'קידוד מידע לקריאה מהירה': 'encoding information for quick reading',
  'קידוד סיסמה בנקאית': 'encoding a bank password',
  'קייב': 'Kyiv',
  'קילוגרם': 'kilogram',
  'קילומטר': 'kilometer',
  "קילימנג'רו": 'Kilimanjaro',
  'קיצור שמות רחובות': 'shortening street names',
  'קירור מים': 'cooling water',
  'קלהארי': 'Kalahari',
  'קליטת רדיו בלבד': 'radio reception only',
  'קנברה': 'Canberra',
  'קנדה': 'Canada',
  'קניית כרטיסי טיסה': 'buying flight tickets',
  'קרדיולוג': 'cardiologist',
  'קרטין': 'keratin',
  'קריאה והשאלת ספרים': 'reading and borrowing books',
  'ראש ממשלה': 'prime minister',
  'רבאט': 'Rabat',
  'רומא': 'Rome',
  'רופא ילדים': 'pediatrician',
  'רוקחות': 'pharmacy',
  'ריאד': 'Riyadh',
  'ריאה': 'lung',
  'רישום מקרקעין': 'land registry',
  'רפואה': 'medicine',
  'רק שופטים מצביעים': 'only judges vote',
  'רשת מזון': 'food chain',
  'שבר בעצם': 'bone fracture',
  'שבתאי': 'Saturn',
  'שדרוג חומרה': 'hardware upgrade',
  'שופטת כדורגל': 'football referee',
  'שחייה': 'swimming',
  'שידור חי למשתמשים': 'live broadcast to users',
  'שידור רדיו': 'radio broadcast',
  'שיטת אלקטורים': 'electoral college system',
  'שיטת הצפנה': 'encryption method',
  'שיטת מיסוי': 'taxation system',
  'שילוב קטע מסרטון אחר בסרטון חדש': 'combining a clip from another video into a new video',
  'שימוש במשאבי מחשוב דרך רשת': 'using computing resources over a network',
  'שימוש חוזר בצליל או שיר בתכנים רבים': 'reusing a sound or song across many posts',
  'שינוי או הוספת אפקט חזותי לסרטון': 'changing or adding a visual effect to a video',
  'שליחת דואר אלקטרוני': 'sending email',
  'שמירת סיסמאות': 'saving passwords',
  'שעשועון בישול': 'cooking game show',
  'שפעת': 'flu',
  'שפת תכנות': 'programming language',
  'תאילנד': 'Thailand',
  'תאית מעץ': 'wood cellulose',
  'תגובה חיסונית': 'immune response',
  'תגמול או תמיכה ביוצרי תוכן': 'rewarding or supporting content creators',
  'תוכניות ריאליטי ופעילות מדיה': 'reality shows and media activity',
  'תוכנית טבע': 'nature program',
  'תוניס': 'Tunis',
  'תוף': 'drum',
  'תיוג וקיבוץ תכנים סביב נושא': 'tagging and grouping content around a topic',
  'תיקון מכוניות': 'car repair',
  'תירוקסין': 'thyroxine',
  'תסיסה': 'fermentation',
  'תעודת משלוח': 'delivery note',
  'תפקיד נשיאותי': 'presidential role',
  'תקן וידאו': 'video standard',
  'תקן חשמל': 'electrical standard',
  'תקשורת באינטרנט': 'internet communication'
};

const questionLead = {
  en: (category, subject) => `Which option is correct for this ${category} fact${subject ? ` about ${subject}` : ''}?`,
  ar: (category, subject) => `ما الخيار الصحيح في ${category}${subject ? ` حول ${subject}` : ''}؟`,
  ru: (category, subject) => `Какой вариант верен в теме ${category}${subject ? `: ${subject}` : ''}?`,
  am: (category, subject) => `በ${category}${subject ? ` ስለ ${subject}` : ''} ትክክለኛው አማራጭ የትኛው ነው?`
};

const explanationTemplates = {
  he: {
    'גאוגרפיה': answer => `התשובה הנכונה היא ${answer}. זהו פרט גאוגרפי שכדאי לזכור כי הוא מחבר בין מקום, מפה והקשר תרבותי רחב.`,
    'היסטוריה': answer => `התשובה הנכונה היא ${answer}. האירוע או התקופה האלו מסמנים נקודת ציון שעוזרת להבין את רצף ההיסטוריה.`,
    'מדע': answer => `התשובה הנכונה היא ${answer}. זהו מושג בסיסי שמופיע שוב ושוב בהבנת טבע, חומר, אנרגיה או גוף האדם.`,
    'רפואה': answer => `התשובה הנכונה היא ${answer}. ההסבר נשען על ידע רפואי בסיסי ומדגיש מושג חשוב בגוף, אבחון או בריאות.`,
    'טכנולוגיה': answer => `התשובה הנכונה היא ${answer}. זהו מושג שימושי בעולם הדיגיטלי, והוא עוזר להבין איך כלים ומערכות מודרניות פועלים.`,
    'פוליטיקה': answer => `התשובה הנכונה היא ${answer}. הרעיון חשוב להבנת מוסדות שלטון, קבלת החלטות ואיזונים במערכת ציבורית.`,
    'טיקטוק': answer => `התשובה הנכונה היא ${answer}. זהו מושג נפוץ בשפת הפלטפורמות החברתיות ומסביר איך תוכן מופץ, נערך או מתגלה.`,
    'רכילות ותרבות ישראלית': answer => `התשובה הנכונה היא ${answer}. זו נקודת תרבות פופולרית שמחברת בין טלוויזיה, מוזיקה, מסך ושיחה ציבורית.`,
    'רכילות ותרבות אמריקאית ועולמית': answer => `התשובה הנכונה היא ${answer}. הפרט הזה בולט בתרבות הפופ העולמית ומופיע הרבה בשיחות על בידור ומדיה.`,
    'ידע כללי': answer => `התשובה הנכונה היא ${answer}. זהו פרט ידע כללי שימושי שמחדד הבחנה בין אפשרויות דומות.`
  },
  en: answer => `The correct answer is ${answer}. This detail is useful because it connects the question to a clear concept and helps separate the right option from similar distractors.`,
  ar: answer => `الإجابة الصحيحة هي ${answer}. هذه المعلومة مفيدة لأنها تربط السؤال بفكرة واضحة وتساعد على التمييز بين الخيارات المتشابهة.`,
  ru: answer => `Правильный ответ: ${answer}. Эта деталь помогает связать вопрос с понятной идеей и отличить верный вариант от похожих ответов.`,
  am: answer => `ትክክለኛው መልስ ${answer} ነው። ይህ መረጃ ጥያቄውን ከግልጽ ሐሳብ ጋር ያገናኛል እና ትክክለኛውን አማራጭ ለመለየት ይረዳል።`
};

function normalizeText(value) {
  return String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function cleanQuestion(value) {
  return normalizeText(value).replace(/^[^:]{0,180}:\s*/, '').replace(/\s+([?.!])$/u, '$1');
}

function difficultyFor(index) {
  const slot = index % 10;
  if (slot < 4) return 'קל';
  if (slot < 7) return 'בינוני';
  if (slot < 9) return 'קשה';
  return 'מומחה';
}

function hasHebrew(value) {
  return /[\u0590-\u05ff]/u.test(value);
}

function translateTerm(value) {
  const clean = normalizeText(value);
  if (/^[\d\s.,:/()+%-]+$/u.test(clean)) return clean;
  if (/^[A-Za-z0-9\s.'&:/()+-]+$/u.test(clean)) return clean;
  return termEn[clean] || clean;
}

function extractSubject(question, correctAnswer) {
  const clean = cleanQuestion(question)
    .replace(/[?.]$/u, '')
    .replace(/^במבחן ידע כללי:\s*/u, '')
    .replace(/^במסגרת חידון מקצועי:\s*/u, '');

  const patterns = [
    /^מהי התשובה הנכונה לגבי\s+(.+)$/u,
    /^איזו אפשרות מתארת נכון את\s+(.+)$/u,
    /^מה נכון לגבי\s+(.+)$/u,
    /^בחרו את התשובה המדויקת ביותר:\s+(.+)$/u,
    /^מה מבין האפשרויות הוא\/היא\s+(.+)$/u,
    /^איזו תשובה תיחשב נכונה עבור השאלה על\s+(.+)$/u,
    /^כשמדברים על\s+(.+),\s*מהי הקביעה הנכונה$/u,
    /^מהי האפשרות המתאימה ביותר ל-?(.+)$/u,
    /^מה צריך להשיב לשאלה העוסקת ב-?(.+)$/u,
    /^איזו מן התשובות הבאות נכונה ביחס ל-?(.+)$/u,
    /^מהו הפרט המרכזי הנכון על\s+(.+)$/u,
    /^ביחס לנושא\s+(.+),\s*מהי התשובה הנכונה$/u,
    /^איזו תשובה משלימה נכון את הנתון\s+(.+)$/u,
    /^מהי הבחירה המדויקת עבור\s+(.+)$/u,
    /^מה נכון לסמן כאשר נשאלים על\s+(.+)$/u,
    /^איזו אפשרות היא העובדה הנכונה על\s+(.+)$/u,
    /^מהו המענה התקין לשאלה\s+(.+)$/u,
    /^איזו תשובה מייצגת נכון את\s+(.+)$/u,
    /^מה נכון מבין ארבע האפשרויות לגבי\s+(.+)$/u
  ];

  const match = patterns.map(pattern => clean.match(pattern)).find(Boolean);
  const subject = normalizeText(match?.[1] || clean);
  const answer = translateTerm(correctAnswer);

  if (!hasHebrew(subject)) return subject;
  if (subject.startsWith('בירת ')) {
    return `the capital of ${translateTerm(subject.replace(/^בירת /u, ''))}`;
  }
  return `${translateTerm(answer)} as the key answer`;
}

function buildTranslations(row, difficulty, options, correctAnswer, explanation) {
  const translations = {};
  for (const locale of locales) {
    const category = categoryTranslations[row.category]?.[locale] || row.category;
    const answer = translateTerm(correctAnswer);
    const localizedOptions = options.map(translateTerm);
    translations[locale] = {
      question: questionLead[locale](category, extractSubject(row.question, correctAnswer)),
      options: localizedOptions,
      explanation: explanationTemplates[locale](answer)
    };
  }
  return translations;
}

function parseRows() {
  const content = fs.readFileSync(SOURCE, 'utf8').replace(/^\uFEFF/u, '').trim();
  if (!content) return [];
  return content.split(/\r?\n/u).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`);
    }
  });
}

const rows = parseRows();
const seen = new Set();
const questions = [];
const unknownTerms = new Set();

for (const [index, row] of rows.entries()) {
  const category = normalizeText(row.category);
  const rawOptions = [row.option_a, row.option_b, row.option_c, row.option_d].map(normalizeText);
  const correctIndex = correctIndexByLetter.get(normalizeText(row.correct_option));
  const correctAnswer = normalizeText(row.correct_answer || rawOptions[correctIndex ?? 0]);
  if (!category || rawOptions.some(option => !option) || correctIndex === undefined) continue;

  for (const option of rawOptions) {
    if (hasHebrew(option) && !termEn[option] && !/לפנה"ס|לספירה|ק"מ לשנייה/u.test(option)) unknownTerms.add(option);
  }

  const question = cleanQuestion(row.question);
  const duplicateKey = [category, question, rawOptions.join('|'), correctIndex].join('::').toLowerCase();
  if (seen.has(duplicateKey)) continue;
  seen.add(duplicateKey);

  const difficulty = difficultyFor(index);
  const explanation = (explanationTemplates.he[category] || explanationTemplates.he['ידע כללי'])(correctAnswer);

  questions.push({
    id: `bank-${normalizeText(row.id || index + 1)}`,
    category,
    difficulty,
    question,
    options: rawOptions,
    correctIndex,
    explanation,
    translations: buildTranslations(row, difficulty, rawOptions, correctAnswer, explanation)
  });
}

if (unknownTerms.size) {
  console.warn(`Warning: ${unknownTerms.size} Hebrew terms are missing English labels.`);
  console.warn([...unknownTerms].sort((a, b) => a.localeCompare(b, 'he')).join('\n'));
}

const categories = questions.reduce((acc, question) => {
  acc[question.category] = (acc[question.category] || 0) + 1;
  return acc;
}, {});

fs.writeFileSync(TARGET, `${JSON.stringify({ questions })}\n`, 'utf8');

console.log(`Imported ${questions.length.toLocaleString('en-US')} questions from ${rows.length.toLocaleString('en-US')} rows.`);
console.log(JSON.stringify(categories, null, 2));

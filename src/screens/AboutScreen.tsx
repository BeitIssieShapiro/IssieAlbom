import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../theme/colors';
import Icon from '@react-native-vector-icons/ionicons';
import { HEADER_HEIGHT } from '../types/Album';

const languages = [
  { code: 'he', label: 'עברית', dir: 'rtl' as const },
  { code: 'en', label: 'English', dir: 'ltr' as const },
  { code: 'ar', label: 'العربية', dir: 'rtl' as const },
];

const aboutContent = {
  he: {
    title: 'אודות',
    paragraphs: [
      'IssieAlbum הוא אפליקציה ליצירת אלבומים אינטראקטיביים ומותאמים אישית.',
      'האפליקציה מאפשרת להוסיף תמונות, ציורים, טקסט, אימוג\'ים והקלטות קוליות לכל עמוד באלבום.',
      'ניתן ליצור אלבומים מותאמים אישית עם רקעים צבעוניים ותבניות מעוצבות, ולשתף אותם עם ילדים ובני משפחה.',
      'האפליקציה פותחה במיוחד עבור ילדים צעירים, עם ממשק ידידותי, צבעוני ונוח לשימוש.',
      'IssieAlbum נוצר על ידי בית איזי שפירא, מרכז לקידום ילדים עם אתגרים התפתחותיים, בשיתוף פעולה עם SAP Labs Israel.',
    ],
  },
  en: {
    title: 'About',
    paragraphs: [
      'IssieAlbum is an app for creating interactive and personalized photo albums.',
      'The app allows you to add photos, drawings, text, emojis, and audio recordings to each page of the album.',
      'You can create custom albums with colorful backgrounds and designed patterns, and share them with children and family.',
      'The app was developed especially for young children, with a friendly, colorful, and easy-to-use interface.',
      'IssieAlbum was created by Beit Issie Shapiro, a center for advancing children with developmental challenges, in cooperation with SAP Labs Israel.',
    ],
  },
  ar: {
    title: 'حول',
    paragraphs: [
      'IssieAlbum هو تطبيق لإنشاء ألبومات صور تفاعلية ومخصصة.',
      'يتيح لك التطبيق إضافة صور ورسومات ونصوص ورموز تعبيرية وتسجيلات صوتية إلى كل صفحة من صفحات الألبوم.',
      'يمكنك إنشاء ألبومات مخصصة مع خلفيات ملونة وأنماط مصممة، ومشاركتها مع الأطفال والعائلة.',
      'تم تطوير التطبيق خصيصًا للأطفال الصغار، بواجهة ودية وملونة وسهلة الاستخدام.',
      'تم إنشاء IssieAlbum بواسطة بيت ايسي شابيرو، مركز لتطوير الأطفال ذوي التحديات التنموية، بالتعاون مع SAP Labs Israel.',
    ],
  },
};

interface AboutScreenProps {
  onClose: () => void;
}

export function AboutScreen({ onClose }: AboutScreenProps) {
  const [lang, setLang] = useState('he');
  const currentLang = languages.find(l => l.code === lang) || languages[0];
  const content = aboutContent[lang as keyof typeof aboutContent] || aboutContent.he;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{content.title}</Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="close" size={30} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Language toggle */}
      <View style={styles.toggleRow}>
        {languages.map(l => (
          <TouchableOpacity
            key={l.code}
            style={[
              styles.toggleButton,
              lang === l.code && styles.toggleButtonActive,
            ]}
            onPress={() => setLang(l.code)}>
            <Text
              allowFontScaling={false}
              style={[
                styles.toggleText,
                lang === l.code && styles.toggleTextActive,
              ]}>
              {l.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}>
        {content.paragraphs.map((paragraph, index) => (
          <Text
            key={index}
            style={[
              styles.paragraph,
              { writingDirection: currentLang.dir },
            ]}>
            {paragraph}
          </Text>
        ))}

        {/* Logo/Branding */}
        <View style={styles.branding}>
          <Text style={styles.brandingText}>🎨 IssieAlbum 📚</Text>
          <Text style={styles.brandingSubtext}>
            {lang === 'he'
              ? 'בית איזי שפירא'
              : lang === 'ar'
              ? 'بيت ايسي شابيرو'
              : 'Beit Issie Shapiro'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.headerBackground,
  },
  headerTitle: {
    fontSize: typography.fontSize.large,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.cardBackground,
  },
  toggleButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.large,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: typography.fontSize.medium,
    color: colors.primary,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  paragraph: {
    fontSize: typography.fontSize.medium,
    lineHeight: 28,
    marginBottom: spacing.lg,
    color: colors.textPrimary,
  },
  branding: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  brandingText: {
    fontSize: typography.fontSize.large,
    marginBottom: spacing.sm,
  },
  brandingSubtext: {
    fontSize: typography.fontSize.medium,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

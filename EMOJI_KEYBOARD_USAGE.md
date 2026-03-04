// Example: How to use Hebrew/Arabic emoji keyboard search in your PageEditorScreen.tsx

// 1. Import the translation and keyword files at the top:
import EmojiPicker, { he, ar } from 'rn-emoji-keyboard';
import type { EmojiType } from 'rn-emoji-keyboard';
import heKeywords from '../assets/emoji-keywords-he.json';
import arKeywords from '../assets/emoji-keywords-ar.json';

// 2. In your component, use the EmojiPicker with customKeywords prop:

// For Hebrew:
<EmojiPicker
  onEmojiSelected={handleEmojiPick}
  open={showEmojiKeyboard}
  onClose={() => setShowEmojiKeyboard(false)}
  translation={he}              // Hebrew UI
  customKeywords={heKeywords}   // Hebrew search keywords
  allowMultipleSelections={false}
  emojiSize={48}
  defaultHeight="50%"
  enableSearchBar={true}
  enableSearchAnimation={true}
/>

// For Arabic:
<EmojiPicker
  onEmojiSelected={handleEmojiPick}
  open={showEmojiKeyboard}
  onClose={() => setShowEmojiKeyboard(false)}
  translation={ar}              // Arabic UI
  customKeywords={arKeywords}   // Arabic search keywords
  allowMultipleSelections={false}
  emojiSize={48}
  defaultHeight="50%"
  enableSearchBar={true}
  enableSearchAnimation={true}
/>

// For English (default, no customKeywords needed):
<EmojiPicker
  onEmojiSelected={handleEmojiPick}
  open={showEmojiKeyboard}
  onClose={() => setShowEmojiKeyboard(false)}
  // translation not specified = English by default
  // customKeywords not specified = English keywords by default
  allowMultipleSelections={false}
  emojiSize={48}
  defaultHeight="50%"
  enableSearchBar={true}
  enableSearchAnimation={true}
/>

// 3. Now users can search for emojis in Hebrew or Arabic!
// Hebrew examples: "לב" (heart), "שמח" (happy), "אוכל" (food)
// Arabic examples: "قلب" (heart), "سعيد" (happy), "طعام" (food)

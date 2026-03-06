// TextElement.tsx
import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { View, Text, TextInput, StyleSheet, LayoutChangeEvent, TextInputProps, ViewProps, ColorValue, TouchableOpacity } from "react-native";
import { SketchText, MoveTypes, SketchPoint, SketchTable } from "./types";
import { calcEffectiveHorizontalLines, tableColWidth, tableRowHeight } from "./utils";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { MyIcon } from "../../common/icons";
import { WordTiming } from "../../types/Album";
import { borderRadius } from "../../theme/colors";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const AnimatedIcon = Animated.createAnimatedComponent(MyIcon);


interface TextElementProps {
    text: SketchText;
    editMode: boolean;
    actualWidth: number;
    ratio: number;
    moveResponder: any;
    moveContext: React.MutableRefObject<any>;
    onTextChanged: (id: string, text: string) => void;
    handleTextLayout: (e: LayoutChangeEvent, text: SketchText) => void;
    handleCursorPositionChange: (newValue: number, text: SketchText) => void;
    tables?: SketchTable[];
    texts: SketchText[];
    canvasHeight: number;
    currentWordIndex?: number; // For highlighting during audio playback
    wordTimings?: WordTiming[]; // Word timings for highlighting
    isViewMode?: boolean; // True when in PageCard view (no editing/moving)
    currentEmojiId?: string | null; // Selected emoji ID
    onEmojiClick?: (emojiId: string) => void; // Click handler for emojis
}

function TextElement({
    text,
    editMode,
    actualWidth,
    ratio,
    moveResponder,
    moveContext,
    onTextChanged,
    handleTextLayout,
    tables,
    texts,
    canvasHeight,
    handleCursorPositionChange,
    currentWordIndex = -1,
    wordTimings,
    isViewMode = false,
    currentEmojiId,
    onEmojiClick,
}: TextElementProps, ref: any) {
    const [revision, setRevision] = useState<number>(0)
    //console.log("text ratio", ratio, actualWidth, text.fontSize)
    const [textTillSelection, setTextTillSelection] = useState<string>(text.text);
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    //const textBGColor = useSharedValue<ColorValue>("lightblue");
    const moveIconDisplay = useSharedValue<'none' | 'flex' | undefined>("flex");
    const table = text.tableId && tables?.find(table => table.id == text.tableId);
    const bgAnimatedStyle = useAnimatedStyle(() => ({
        //backgroundColor: textBGColor.value,
        outlineWidth: 2,
        outlineColor: "gray",
        outlineOffset: 1
    }));
    const visibleAnimatedStyle = useAnimatedStyle(() => ({
        display: moveIconDisplay.value
    }));

    useImperativeHandle(ref, () => ({
        prepareForThumbnail: () => {
            console.log("prep for tn")
            //textBGColor.value = "transparent";
            moveIconDisplay.value = "none";
        },
    }));

    useEffect(() => {

        //textBGColor.value = (text.color == '#fee100' ? "gray" : "lightblue");
        moveIconDisplay.value = "flex";
    }, [text.color, editMode])

    useEffect(() => {
        setTextTillSelection(text.text.substring(0, selection.end))
    }, [selection]);

    useEffect(() => {
        if (editMode) {
            // when entering edit mode, the cursor at the end
            setTextTillSelection(text.text)
        }
    }, [editMode]);


    // if (text.tableId) {
    //     console.log("text table",text.tableId, table)
    // } else {
    //     console.log("text ",text)
    // }
    const horizontalLines = table ? calcEffectiveHorizontalLines(table, canvasHeight, texts) : [];
    const posStyle: any = table ?
        {
            position: "absolute",

            ...(text.rtl ?
                { right: actualWidth - (table.verticalLines[text.x + 1] - table.strokeWidth / 2) * ratio, } :
                { left: (table.verticalLines[text.x] + table.strokeWidth / 2) * ratio }
            ),
            top: (horizontalLines[text.y]) * ratio + table.strokeWidth / 2,
            width: tableColWidth(table, text.x) * ratio - table.strokeWidth,
            minHeight: tableRowHeight(table, text.y) * ratio - table.strokeWidth,
            //maxHeight: tableRowHeight(table, text.y) * ratio - table.strokeWidth,
        } :
        {
            position: "absolute",
            ...(text.rtl ?
                { right: actualWidth - text.x * ratio }
                : { left: text.x * ratio }),
            top: text.y * ratio,
            maxWidth: text.rtl ? text.x * ratio - 3 :
                actualWidth - text.x * ratio - 3,
        };

    const widthStyle = text.width ? { width: text.width * ratio } : undefined;

    const style: any = {
        color: text.color, fontSize: text.fontSize * ratio,
        textAlign: text.alignment.toLowerCase(),
        fontFamily: text.fontFamily, // could be undefined
        fontWeight: text.bold ? 'bold' : 'normal',
        fontStyle: text.italic ? 'italic' : 'normal',
        textDecorationLine: text.underline ? 'underline' : 'none',
    };

    const moveIconStyle: any = { position: "absolute", ...(text.rtl ? { right: -25 } : { left: -25 }) }
    // console.log("text style", widthStyle)
    if (editMode) {
        return (
            <Animated.View
                //direction={text.rtl ? "rtl" : "ltr"}
                key={text.id}
                style={[styles.textInputHost, posStyle, { zIndex: 500 }, table && bgAnimatedStyle]}
                {...(table ? {} : moveResponder.panHandlers)}
                onStartShouldSetResponder={(e) => {
                    // Edit mode uses offset-based movement (no initialPosition)
                    moveContext.current = { type: MoveTypes.TextMove, id: text.id, offsetX: text.rtl ? -15 : 15, offsetY: -15 };
                    return moveResponder.panHandlers?.onStartShouldSetResponder?.(e) || false;
                }}
            >
                {!table && <AnimatedIcon style={[moveIconStyle, visibleAnimatedStyle]} info={{ type: "Ionicons", name: "move", size: 25, color: "blue" }} />}
                <>
                    <AnimatedTextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        allowFontScaling={false}
                        multiline
                        autoFocus
                        textAlignVertical="top"
                        style={[styles.textStyle, style, bgAnimatedStyle,
                        !table && widthStyle,
                        table && { width: posStyle.width },
                        !table && { minWidth: Math.max(text.fontSize * ratio, 20 / ratio) }
                        ]}
                        value={text.text}
                        onChange={(tic) => onTextChanged(text.id, tic.nativeEvent.text)}
                        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                    />
                    {/* Hidden Text to measure layout */}
                    <Text
                        allowFontScaling={false}
                        style={[styles.textStyle, posStyle, style, { position: "absolute", [text.rtl ? "right" : "left"]: -10000, minHeight: 0 }, !table && { minWidth: 20 / ratio }]}
                        onLayout={(e) => {
                            handleTextLayout(e, text)
                            setRevision(prev => prev + 1)
                        }}
                    >
                        {text.text + "M"}
                    </Text>
                    {/* Second Hidden Text for Cursor Tracking */}
                    <Text
                        allowFontScaling={false}
                        style={[styles.textStyle, posStyle, style, { position: "absolute", [text.rtl ? "right" : "left"]: -10000, minHeight: 0 }, !table && { minWidth: 20 / ratio }]}
                        onLayout={(e) => {

                            const cursorHeightFromTop = e.nativeEvent.layout.height;
                            // Use this value to trigger a scroll if it's too close to the keyboard
                            handleCursorPositionChange(cursorHeightFromTop, text);
                        }}
                    >
                        {/* Only render text up to the selection start */}
                        {textTillSelection}
                        {/* {text.text.substring(0, selection.start) + 'A'} */}
                    </Text>
                </>
            </Animated.View>
        );
    }

    // Split text into words for highlighting
    const renderTextWithHighlight = () => {
        if (currentWordIndex < 0) {
            return text.text;
        }

        // If no word timings, highlight entire text
        if (!wordTimings || wordTimings.length === 0) {
            return (
                <Text style={{ backgroundColor: '#FFD700', color: '#000' }}>
                    {text.text}
                </Text>
            );
        }

        // Split text by words and highlight based on word timings
        const words = text.text.split(/\s+/);
        return (
            <>
                {words.map((word, index) => {
                    const isHighlighted = index === currentWordIndex;
                    return (
                        <Text
                            key={index}
                            style={isHighlighted ? { backgroundColor: '#FFD700', color: '#000' } : undefined}
                        >
                            {word}{index < words.length - 1 ? ' ' : ''}
                        </Text>
                    );
                })}
            </>
        );
    };

    // For emojis outside edit mode: render with selection support (but not in view mode)
    // Movement is handled by sketchResponder in canvas.tsx
    if (text.isEmoji && !editMode && !isViewMode) {
        const isSelected = currentEmojiId === text.id;
        const rotationDegrees = text.rotation || 0;

        // When selected, compensate for border (2px) + padding (4px) = 6px offset
        const borderOffset = isSelected ? -6 : 0;
        const adjustedPosStyle = isSelected ? {
            ...posStyle,
            left: posStyle.left !== undefined ? posStyle.left + borderOffset : undefined,
            right: posStyle.right !== undefined ? posStyle.right + borderOffset : undefined,
            top: posStyle.top + borderOffset,
        } : posStyle;

        return (
            <TouchableOpacity
                key={text.id}
                style={[
                    adjustedPosStyle,
                    { zIndex: 3000 },
                    isSelected && {
                        borderWidth: 2,
                        borderColor: '#007AFF',
                        borderRadius: 8,
                        padding: 4,
                    }
                ]}
                activeOpacity={1}
                onPress={() => onEmojiClick?.(text.id)}
            >
                <Text
                    allowFontScaling={false}
                    style={[
                        styles.textStyle,
                        style,
                        {
                            transform: [{ rotate: `${rotationDegrees}deg` }],
                        }
                    ]}
                >
                    {text.text}
                </Text>
            </TouchableOpacity>
        );
    }

    // For emojis in view mode, just render the emoji without move icon
    if (text.isEmoji && isViewMode) {
        const rotationDegrees = text.rotation || 0;
        console.log('TextElement [view mode] - emoji:', text.id, 'rotation:', text.rotation, 'rotationDegrees:', rotationDegrees);
        return (
            <View key={text.id} style={posStyle}>
                <Text
                    allowFontScaling={false}
                    style={[
                        styles.textStyle,
                        style,
                        {
                            transform: [{ rotate: `${rotationDegrees}deg` }],
                        }
                    ]}
                >
                    {text.text}
                </Text>
            </View>
        );
    }

    return (
        <View key={text.id} style={posStyle}>
            <Text
                allowFontScaling={false}
                selectable={true}
                style={[styles.textStyle, style,
                table && { width: posStyle.width },
                    // !table && { textAlign: "left" }
                ]}
                onLayout={(e) => handleTextLayout(e, text)}
            >
                {renderTextWithHighlight()}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    textInputHost: {
        zIndex: 3000,
        flexDirection: "row",
    },
    textStyle: {
        padding: 0,
        margin: 0,
        flexWrap: "wrap",
        zIndex: 13,
    },

});

export default forwardRef(TextElement);

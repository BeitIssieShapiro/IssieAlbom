import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  PanResponder,
  Alert,
} from 'react-native';
import { AudioWaveform } from './AudioWaveform';
import Sound from 'react-native-nitro-sound';
import { MyIcon } from '../common/icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_WIDTH = SCREEN_WIDTH * 0.9;
const WAVEFORM_HEIGHT = 150;

export interface WordTiming {
  word: string;
  startTime: number; // in seconds
}

interface AudioWordMappingModalProps {
  visible: boolean;
  audioFile: string;
  titleText: string;
  audioDuration?: number; // Duration in seconds (from stored audio element)
  initialWordTimings?: WordTiming[];
  onClose: (wordTimings: WordTiming[]) => void; // Called when modal closes with final state
  onReRecord?: () => void;
  onDelete?: () => void;
}

export function AudioWordMappingModal({
  visible,
  audioFile,
  titleText,
  audioDuration: propDuration,
  initialWordTimings = [],
  onClose,
  onReRecord,
  onDelete,
}: AudioWordMappingModalProps) {
  // Simple state - single source of truth
  const [audioDuration, setAudioDuration] = useState(propDuration || 10);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [draggingX, setDraggingX] = useState<number>(0);
  const draggingTimingsRef = useRef<WordTiming[]>([]);

  // Refs to avoid closure traps
  const audioDurationRef = useRef(audioDuration);
  const wordTimingsRef = useRef<WordTiming[]>([]);

  // Simple flags
  const initializedRef = useRef(false);
  const hasAppliedHeuristicsRef = useRef(false);
  const hasTitle = titleText && titleText.trim().length > 0;

  // Sync refs
  useEffect(() => {
    audioDurationRef.current = audioDuration;
  }, [audioDuration]);

  useEffect(() => {
    wordTimingsRef.current = wordTimings;
  }, [wordTimings]);

  // Use prop duration if provided
  useEffect(() => {
    console.log('[AudioWordMappingModal] propDuration effect:', propDuration);
    if (propDuration && propDuration > 0) {
      console.log('[AudioWordMappingModal] Setting audioDuration from prop:', propDuration);
      setAudioDuration(propDuration);
    }
  }, [propDuration]);

  // Initialize ONCE on mount
  useEffect(() => {
    console.log('[AudioWordMappingModal] Mount effect - initialized:', initializedRef.current);
    if (initializedRef.current) return;

    const parsedWords = titleText.split(/\s+/).filter(w => w.length > 0);
    console.log('[AudioWordMappingModal] Mount - parsedWords:', parsedWords.length, 'initialWordTimings:', initialWordTimings.length, 'audioDuration:', audioDuration);

    if (initialWordTimings.length > 0) {
      // Use existing mappings as-is (Requirement #5)
      console.log('[AudioWordMappingModal] Using existing mappings:', initialWordTimings);
      setWordTimings(initialWordTimings);
      wordTimingsRef.current = initialWordTimings; // Update ref immediately
      hasAppliedHeuristicsRef.current = true; // Don't apply heuristics
    } else if (parsedWords.length > 0) {
      // Create initial even distribution
      const timings: WordTiming[] = parsedWords.map((word, index) => ({
        word,
        startTime: (index / parsedWords.length) * audioDuration,
      }));
      console.log('[AudioWordMappingModal] Creating initial even distribution:', timings);
      setWordTimings(timings);
      wordTimingsRef.current = timings; // Update ref immediately so handleAudioLoad can see it
      // Don't mark hasAppliedHeuristicsRef yet - let handleAudioLoad optimize if it has timing data
    }

    initializedRef.current = true;
    console.log('[AudioWordMappingModal] Initialization complete, hasAppliedHeuristics:', hasAppliedHeuristicsRef.current);
  }, []);

  const handleAudioLoad = (duration: number) => {
    console.log('[AudioWordMappingModal] handleAudioLoad called - duration:', duration, 'propDuration:', propDuration, 'hasAppliedHeuristics:', hasAppliedHeuristicsRef.current);
    console.log('[AudioWordMappingModal] wordTimings state length:', wordTimings.length, 'wordTimings ref length:', wordTimingsRef.current.length);

    // If we already have the correct duration from props, don't do anything
    if (propDuration && Math.abs(propDuration - duration) < 0.1) {
      // Duration matches what we already know, mark as applied and don't re-distribute
      console.log('[AudioWordMappingModal] Duration matches prop, skipping re-distribution');
      hasAppliedHeuristicsRef.current = true;
      return;
    }

    // Update duration if it changed
    console.log('[AudioWordMappingModal] Updating audioDuration to:', duration);
    setAudioDuration(duration);

    // Use ref to check word timings (state might not be updated yet)
    const currentWordTimings = wordTimingsRef.current;

    // Apply heuristics if we haven't already and no initial mappings existed
    if (!hasAppliedHeuristicsRef.current && currentWordTimings.length > 0) {
      // TODO: In the future, use waveform timing data if available
      // For now, re-distribute based on actual duration (simple even distribution)
      const parsedWords = titleText.split(/\s+/).filter(w => w.length > 0);
      const optimizedTimings: WordTiming[] = parsedWords.map((word, index) => ({
        word,
        startTime: (index / parsedWords.length) * duration,
      }));
      console.log('[AudioWordMappingModal] Re-distributing with new duration:', optimizedTimings);
      setWordTimings(optimizedTimings);
      hasAppliedHeuristicsRef.current = true;
    } else {
      console.log('[AudioWordMappingModal] Skipping re-distribution - hasAppliedHeuristics:', hasAppliedHeuristicsRef.current, 'currentWordTimings.length:', currentWordTimings.length);
    }
  };

  const handlePlay = async () => {
    if (playing) {
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
      setPlaying(false);
      setCurrentTime(0);
    } else {
      try {
        const filePath = audioFile.startsWith('file://') ? audioFile : `file://${audioFile}`;
        await Sound.startPlayer(filePath);

        Sound.addPlayBackListener((e) => {
          // Get actual duration from the first event
          if (e.duration > 0 && audioDuration === 10) {
            const durationInSeconds = e.duration / 1000;
            setAudioDuration(durationInSeconds);
          }

          setCurrentTime(e.currentPosition / 1000); // Convert to seconds
          if (e.currentPosition >= e.duration && e.duration > 0) {
            setPlaying(false);
            setCurrentTime(0);
            Sound.stopPlayer().catch(console.error);
          }
        });
        setPlaying(true);
      } catch (error) {
        console.error('Failed to play audio:', error);
        Alert.alert('שגיאה', 'הפעלת השמע נכשלה');
      }
    }
  };

  const handleWordMarkerDragMove = (wordIndex: number, currentX: number) => {
    setDraggingIndex(wordIndex);
    setDraggingX(currentX);

    // Use refs to avoid closure trap
    const currentAudioDuration = audioDurationRef.current;
    const currentWordTimings = wordTimingsRef.current;

    // Update dragging ref with current positions
    const waveformWidth = MODAL_WIDTH - 40;
    const newTime = (currentX / waveformWidth) * currentAudioDuration;
    const updatedTimings = [...currentWordTimings];
    updatedTimings[wordIndex] = {
      ...updatedTimings[wordIndex],
      startTime: Math.max(0, Math.min(currentAudioDuration, newTime)),
    };
    draggingTimingsRef.current = updatedTimings;
  };

  const handleWordMarkerDragEnd = (wordIndex: number, newX: number) => {
    // Use refs to avoid closure trap
    const currentAudioDuration = audioDurationRef.current;
    const currentWordTimings = wordTimingsRef.current;

    const waveformWidth = MODAL_WIDTH - 40;
    const WORD_GAP = 10;

    // Use dragging timings if available (current positions during drag)
    const currentTimings = draggingTimingsRef.current.length > 0 ? draggingTimingsRef.current : currentWordTimings;

    const timeToX = (time: number) => (time / currentAudioDuration) * waveformWidth;

    const minX = wordIndex > 0 ? timeToX(currentTimings[wordIndex - 1].startTime) + WORD_GAP : 0;
    const maxX = wordIndex < currentTimings.length - 1 ? timeToX(currentTimings[wordIndex + 1].startTime) - WORD_GAP : waveformWidth;
    const constrainedX = Math.max(minX, Math.min(maxX, newX));
    const newTime = (constrainedX / waveformWidth) * currentAudioDuration;

    const updatedTimings = [...currentTimings];
    updatedTimings[wordIndex] = {
      ...updatedTimings[wordIndex],
      startTime: Math.max(0, Math.min(currentAudioDuration, newTime)),
    };

    setWordTimings(updatedTimings);
    setDraggingIndex(null);
    draggingTimingsRef.current = [];
  };

  const handleClose = async () => {
    // Stop playback if active
    if (playing) {
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
      setPlaying(false);
    }

    // Use ref to get latest word timings (avoid closure trap)
    const finalWordTimings = wordTimingsRef.current;

    // Pass final word timings to parent
    onClose(finalWordTimings);
  };

  const handleDelete = async () => {
    // Stop playback if active
    if (playing) {
      await Sound.stopPlayer();
      Sound.removePlayBackListener();
      setPlaying(false);
    }

    onDelete?.();
  };

  const timeToX = (time: number) => {
    const waveformWidth = MODAL_WIDTH - 40;
    return (time / audioDuration) * waveformWidth;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {hasTitle ? 'מיפוי מילים לשמע' : 'ניהול שמע'}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
            >
              <MyIcon info={{ name: 'close', size: 24, color: '#666', type: 'MDI' }} />
            </TouchableOpacity>
          </View>

          {/* Only show word mapping UI if there's a title (requirement #2) */}
          {hasTitle && (
            <>
              {/* Word Markers */}
              <View style={styles.wordsContainer}>
                <View style={styles.wordsRow}>
                  {wordTimings.map((wt, index) => {
                    const waveformWidth = MODAL_WIDTH - 40;
                    const WORD_GAP = 10; // Minimum gap between words in pixels
                    const minX = index > 0 ? timeToX(wordTimings[index - 1].startTime) + WORD_GAP : 0;
                    const maxX = index < wordTimings.length - 1 ? timeToX(wordTimings[index + 1].startTime) - WORD_GAP : waveformWidth;
                    const pos = timeToX(wt.startTime);

                    return (
                      <WordMarker
                        key={wt.word + index}
                        word={wt.word}
                        position={pos}
                        minX={minX}
                        maxX={maxX}
                        onDragMove={(currentX) => handleWordMarkerDragMove(index, currentX)}
                        onDragEnd={(newX) => handleWordMarkerDragEnd(index, newX)}
                        isActive={currentTime >= wt.startTime &&
                          (index === wordTimings.length - 1 || currentTime < wordTimings[index + 1].startTime)}
                      />
                    );
                  })}
                </View>
              </View>

              {/* Waveform */}
              <View style={styles.waveformContainer}>
                <AudioWaveform
                  audioFile={audioFile}
                  width={MODAL_WIDTH - 40}
                  height={WAVEFORM_HEIGHT}
                  onLoad={handleAudioLoad}
                />

                {/* Word marker lines */}
                {wordTimings.map((wt, index) => {
                  // If this word is being dragged, use dragging position, otherwise use timing position
                  const x = (draggingIndex === index) ? draggingX : timeToX(wt.startTime);
                  return (
                    <View
                      key={`line-${index}`}
                      style={[
                        styles.markerLine,
                        { left: x },
                        draggingIndex === index && styles.markerLineDragging
                      ]}
                    />
                  );
                })}

                {/* Playback position indicator */}
                {playing && (
                  <View
                    style={[styles.playbackIndicator, { left: timeToX(currentTime) }]}
                  />
                )}
              </View>
            </>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            {onDelete && (
              <TouchableOpacity
                style={[styles.controlButton, styles.deleteButton]}
                onPress={handleDelete}
              >
                <MyIcon info={{ name: 'delete', size: 28, color: '#FF3B30', type: 'MDI' }} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.controlButton}
              onPress={onReRecord}
            >
              <MyIcon info={{ name: 'microphone', size: 28, color: '#C8572A', type: 'MDI' }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.playButton]}
              onPress={handlePlay}
            >
              <MyIcon
                info={{
                  name: playing ? 'pause' : 'play',
                  size: 32,
                  color: '#fff',
                  type: 'MDI',
                }}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface WordMarkerProps {
  word: string;
  position: number;
  onDragMove: (currentX: number) => void;
  onDragEnd: (newX: number) => void;
  isActive: boolean;
  minX?: number;
  maxX?: number;
}

const WordMarker = React.memo(function WordMarker({ word, position, onDragMove, onDragEnd, isActive, minX = 0, maxX = 1000 }: WordMarkerProps) {
  const [localPosition, setLocalPosition] = useState(position);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(position);
  const prevPositionRef = useRef(position);
  const localPositionRef = useRef(position);

  // Refs to avoid closure trap in panResponder
  const minXRef = useRef(minX);
  const maxXRef = useRef(maxX);
  const onDragMoveRef = useRef(onDragMove);
  const onDragEndRef = useRef(onDragEnd);

  // Sync localPosition to ref
  useEffect(() => {
    localPositionRef.current = localPosition;
  }, [localPosition]);

  // Sync refs
  useEffect(() => {
    minXRef.current = minX;
  }, [minX]);

  useEffect(() => {
    maxXRef.current = maxX;
  }, [maxX]);

  useEffect(() => {
    onDragMoveRef.current = onDragMove;
  }, [onDragMove]);

  useEffect(() => {
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd]);

  // Only update local position when prop changes AND we're not dragging AND position actually changed
  useEffect(() => {
    if (!isDragging && Math.abs(position - prevPositionRef.current) > 0.1) {
      setLocalPosition(position);
      prevPositionRef.current = position;
    }
  }, [position, isDragging]);

  // Create panResponder once with useRef
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        // Use current localPosition as drag start (from ref to avoid closure)
        dragStartRef.current = localPositionRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        const newX = dragStartRef.current + gesture.dx;
        const constrainedX = Math.max(minXRef.current, Math.min(maxXRef.current, newX));
        setLocalPosition(constrainedX);
        onDragMoveRef.current(constrainedX);
      },
      onPanResponderRelease: (_, gesture) => {
        const finalX = dragStartRef.current + gesture.dx;
        const constrainedX = Math.max(minXRef.current, Math.min(maxXRef.current, finalX));
        setIsDragging(false);
        onDragEndRef.current(constrainedX);
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.wordMarker,
        {
          left: localPosition,
        },
        isActive && styles.wordMarkerActive,
        isDragging && styles.wordMarkerDragging
      ]}
      {...panResponder.panHandlers}
    >
      <Text style={[styles.wordText, isActive && styles.wordTextActive]}>{word}</Text>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if position changed by more than 0.1px
  return (
    prevProps.word === nextProps.word &&
    Math.abs(prevProps.position - nextProps.position) < 0.1 &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.minX === nextProps.minX &&
    prevProps.maxX === nextProps.maxX
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    maxHeight: SCREEN_HEIGHT * 0.85,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ddd',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#34C759',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  wordsContainer: {
    height: 50,
    marginBottom: 10,
  },
  wordsRow: {
    flexDirection: 'row',
    position: 'relative',
    height: '100%',
  },
  wordMarker: {
    position: 'absolute',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordMarkerActive: {
    backgroundColor: '#FF9500',
  },
  wordMarkerDragging: {
    opacity: 0.8,
    transform: [{ scale: 1.1 }],
  },
  wordText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  wordTextActive: {
    color: '#fff',
  },
  waveformContainer: {
    position: 'relative',
    marginBottom: 30,
  },
  markerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(0, 122, 255, 0.5)',
  },
  markerLineDragging: {
    backgroundColor: 'rgba(255, 149, 0, 0.8)',
    width: 3,
  },
  playbackIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FF3B30',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    marginBottom: 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FFF0F0',
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#007AFF',
  },
});

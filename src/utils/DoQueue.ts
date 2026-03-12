export interface QueueElement {
  elem?: any;
  elemID?: string;
  type: string;
  withPrevious?: boolean;
}

export default class DoQueue {
  private _doneQueue: QueueElement[] = [];
  private _undoQueue: QueueElement[] = [];
  private _onAttachmentRemove?: (attachName: string) => Promise<void>;

  constructor(onAttachmentRemove?: (attachName: string) => Promise<void>) {
    this._onAttachmentRemove = onAttachmentRemove;
  }

  async clearUndo() {
    // Build a set of all attachments still referenced in the done queue
    const referencedAttachments = new Set<string>();
    for (const elem of this._doneQueue) {
      if (elem.elem?.audioPath) {
        referencedAttachments.add(elem.elem.audioPath);
      }
      if (elem.elem?.imagePath) {
        referencedAttachments.add(elem.elem.imagePath);
      }
    }

    // Only delete attachments from undo queue if they're NOT in done queue
    for (const elem of this._undoQueue) {
      // Check for audio attachments
      if (elem.elem?.audioPath && this._onAttachmentRemove) {
        if (!referencedAttachments.has(elem.elem.audioPath)) {
          await this._onAttachmentRemove(elem.elem.audioPath);
        }
      }
      // Check for image attachments
      if (elem.elem?.imagePath && this._onAttachmentRemove) {
        if (!referencedAttachments.has(elem.elem.imagePath)) {
          await this._onAttachmentRemove(elem.elem.imagePath);
        }
      }
    }
    this._undoQueue = [];
  }

  pushPath(elem: any) {
    this.add({ elem, type: 'path' });
    this.clearUndo();
  }

  pushDeletePath(elem: any) {
    this.add({ elem, type: 'pathDelete' });
    this.clearUndo();
  }

  pushText(elem: any) {
    this.add({ elem, type: 'text' });
    this.clearUndo();
  }

  pushTextDelete(id: string) {
    this.add({ elem: { id }, type: 'textDelete' });
    this.clearUndo();
  }

  pushImage(elem: any) {
    this.add({ elem, type: 'image' });
    this.clearUndo();
  }

  pushImagePosition(elem: any) {
    this.add({ elem, type: 'imagePosition' });
    this.clearUndo();
  }

  pushDeleteImage(elem: any) {
    this.add({ elem, type: 'imageDelete' });
    this.clearUndo();
  }

  pushAudio(elem: any) {
    this.add({ elem, type: 'audio' });
    this.clearUndo();
  }

  pushAudioPosition(elem: any) {
    this.add({ elem, type: 'audioPosition' });
    this.clearUndo();
  }

  pushDeleteAudio(elem: any) {
    this.add({ elem, type: 'audioDelete' });
    this.clearUndo();
  }

  pushLine(elem: any) {
    this.add({ elem, type: 'line' });
    this.clearUndo();
  }

  pushDeleteLine(id: string) {
    this.add({ elem: { id }, type: 'lineDelete' });
    this.clearUndo();
  }

  pushTable(elem: any) {
    const cleanedElem = { ...elem };
    delete cleanedElem.minHeights;
    delete cleanedElem.clone;
    this.add({ elem: cleanedElem, type: 'table' });
    this.clearUndo();
  }

  pushDeleteTable(id: string) {
    this.add({ elem: { id }, type: 'tableDelete' });
    this.clearUndo();
  }

  pushTableCellText(elem: any) {
    this.add({ elem, type: 'tableCellText' });
    this.clearUndo();
  }

  pushBackgroundPattern(elem: any) {
    this.add({ elem, type: 'backgroundPattern' });
    this.clearUndo();
  }

  pushTiles(elem: any) {
    this.add({ elem, type: 'tiles' });
    this.clearUndo();
  }

  pushDeleteTiles() {
    this.add({ type: 'tilesDelete' });
    this.clearUndo();
  }

  pushMany(elemArray: QueueElement[]) {
    elemArray.forEach((elem, i) => {
      if (i > 0) {
        elem.withPrevious = true;
      }
      this.add(elem);
    });
    this.clearUndo();
  }

  pushChangePageHeightAddition(height: number) {
    this.add({ type: 'changePageHeightAddition', elem: { height } });
    this.clearUndo();
  }

  add(queueElem: QueueElement) {
    this._doneQueue.push(queueElem);
  }

  undo(baselineLength?: number): boolean {
    // If baseline is provided, don't allow undo past that point
    if (baselineLength !== undefined && this._doneQueue.length <= baselineLength) {
      return false;
    }

    if (this._doneQueue.length > 0) {
      // Don't undo if only background remains
      if (this._doneQueue.length === 1 && this._doneQueue[0].type === 'background') {
        return false;
      }

      const elem = this._doneQueue.pop()!;
      if (elem.withPrevious) {
        this.undo(baselineLength);
      }
      this._undoQueue.push(elem);
      return true;
    }
    return false;
  }

  redo(): boolean {
    if (this._undoQueue.length > 0) {
      const elem = this._undoQueue.pop()!;
      if (elem.withPrevious) {
        this.redo();
      }
      this._doneQueue.push(elem);
      return true;
    }
    return false;
  }

  popDraft(): QueueElement | undefined {
    if (this._doneQueue.length > 0) {
      const lastElem = this._doneQueue[this._doneQueue.length - 1];
      if (lastElem.elem?.draft) {
        return this._doneQueue.pop();
      }
    }
    return undefined;
  }

  canUndo(baselineLength?: number): boolean {
    // If baseline is provided, don't allow undo past that point
    if (baselineLength !== undefined && this._doneQueue.length <= baselineLength) {
      return false;
    }

    return this._doneQueue.length > 0 &&
           !(this._doneQueue.length === 1 && this._doneQueue[0].type === 'background');
  }

  canRedo(): boolean {
    return this._undoQueue.length > 0;
  }

  getAll(): QueueElement[] {
    return this._doneQueue;
  }

  getQueueLength(): number {
    return this._doneQueue.length;
  }

  clear() {
    this._doneQueue = [];
    this.clearUndo();
  }

  static getBackgroundMetadata(pageType: string): string {
    return JSON.stringify({
      version: '2.0',
      elements: [{ type: 'background', elem: { type: pageType } }],
    }, undefined, ' ');
  }
}

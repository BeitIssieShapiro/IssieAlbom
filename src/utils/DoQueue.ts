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
    for (const elem of this._undoQueue) {
      // Check for audio attachments
      if (elem.elem?.audioPath && this._onAttachmentRemove) {
        await this._onAttachmentRemove(elem.elem.audioPath);
      }
      // Check for image attachments
      if (elem.elem?.imagePath && this._onAttachmentRemove) {
        await this._onAttachmentRemove(elem.elem.imagePath);
      }
    }
    this._undoQueue = [];
  }

  pushPath(elem: any) {
    this.add({ elem, type: 'path' });
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

  undo(): boolean {
    if (this._doneQueue.length > 0) {
      // Don't undo if only background remains
      if (this._doneQueue.length === 1 && this._doneQueue[0].type === 'background') {
        return false;
      }

      const elem = this._doneQueue.pop()!;
      if (elem.withPrevious) {
        this.undo();
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

  canUndo(): boolean {
    return this._doneQueue.length > 0 &&
           !(this._doneQueue.length === 1 && this._doneQueue[0].type === 'background');
  }

  canRedo(): boolean {
    return this._undoQueue.length > 0;
  }

  getAll(): QueueElement[] {
    return this._doneQueue;
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

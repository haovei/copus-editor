/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { ElementNode, LexicalCommand, LexicalNode, NodeKey, RangeSelection, TextNode } from 'lexical';
import { $getMarkIDs, $wrapSelectionInMarkNode } from '@lexical/mark';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findMatchingParent, mergeRegister, registerNestedElementResolver } from '@lexical/utils';
import {
  $createRangeSelection,
  $getNodeByKey,
  $getPreviousSelection,
  $getRoot,
  $getSelection,
  $isLeafNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  CLICK_COMMAND,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_NORMAL,
  createCommand,
  PASTE_COMMAND,
} from 'lexical';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { $createMarkNodeX, $isMarkNodeX, MarkNodeX, MarkXType } from '../../nodes/MarkNodeX';
import { SourceInputBox } from './SourceInputBox';
import { CopusList } from './CopusList';
import { getSelectedNode } from '../../utils/getSelectedNode';
import './index.less';
import { $isParagraphNodeX, ParagraphNodeX } from '../../nodes/ParagraphNodeX';
import { EditorShellProps } from '../../EditorShell';

export const INSERT_INLINE_COMMAND: LexicalCommand<void> = createCommand('INSERT_INLINE_COMMAND');

export default function CopusPlugin({ copus = {} }: { copus: EditorShellProps['copus'] }): JSX.Element {
  const { getMarkInfo, createMark, opusUuid, opusId } = copus;
  const [editor] = useLexicalComposerContext();
  const markNodeXMap = useMemo<Map<string, Set<NodeKey>>>(() => {
    return new Map();
  }, []);
  const [activeAnchorKey, setActiveAnchorKey] = useState<NodeKey | null>();
  const [activeIDs, setActiveIDs] = useState<Array<string>>([]);
  const [showSourceInput, setShowSourceInput] = useState(false);
  const [selectCopusList, setSelectCopusList] = useState<Array<string>>();

  const cancelAddSource = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();
      if (selection !== null) {
        selection.dirty = true;
      }
    });
    setShowSourceInput(false);
  }, [editor]);

  const submitAddSource = useCallback(
    ({ sourceLink, selection }: { sourceLink?: string; selection?: RangeSelection | null }) => {
      editor.update(() => {
        if ($isRangeSelection(selection)) {
          const isBackward = selection.isBackward();
          const [start, end] = isBackward ? [selection.focus, selection.anchor] : [selection.anchor, selection.focus];

          const startNode = start.getNode();
          const endNode = end.getNode();
          const startTopNode = startNode.getTopLevelElement() as ParagraphNodeX;
          const endTopNode = endNode.getTopLevelElement() as ParagraphNodeX;

          let startOffset = start.offset;
          startTopNode.getAllTextNodes().find((textNode) => {
            if (textNode === startNode) return true;
            startOffset += textNode.getTextContentSize();
            return false;
          });
          let endOffset = end.offset;
          endTopNode.getAllTextNodes().find((textNode) => {
            if (textNode === endNode) return true;
            endOffset += textNode.getTextContentSize();
            return false;
          });

          createMark?.({
            opusUuid,
            opusId,
            startNodeId: startTopNode.getId(),
            startNodeAt: startOffset,
            endNodeId: endTopNode.getId(),
            endNodeAt: endOffset,
            textContent: selection.getTextContent(),
            sourceLink,
          }).then((mark) => {
            editor.update(() => {
              if (mark?.id) {
                $wrapSelectionInMarkNode(selection, isBackward, mark.id, (ids) => {
                  return new MarkNodeX({ ids, source: mark.sourceCount });
                });
              }
            });
          });
        }
      });
      setShowSourceInput(false);
    },
    [editor, opusUuid, createMark],
  );

  const handlCopyData = useCallback(
    (data?: MarkXType) => {
      if (data !== undefined) {
        // record copy source information
        createMark?.(data);

        const previousSelection = $getSelection();
        if (previousSelection === null) {
          return;
        }
        const previousPoints = previousSelection.getStartEndPoints();
        if (previousPoints === null) {
          return;
        }
        let [prevStart, prevEnd] = previousPoints;
        if (previousSelection.isBackward()) [prevStart, prevEnd] = [prevEnd, prevStart];
        const anchorNode = prevStart.getNode() as TextNode;
        const anchorOffset = prevStart.offset;

        // Fix: 当段落为空时，粘贴多段落，会自动替换原有节点，导致无法找到
        let needFix = false;
        let topNodeIndex = 0;
        const anchorTopNode = anchorNode.getTopLevelElement();
        if (anchorOffset === 0) {
          needFix = true;
          const root = $getRoot();
          topNodeIndex = root.getChildren().indexOf(anchorTopNode!);
        }

        // paste end
        setTimeout(() => {
          editor.update(() => {
            const currentSelection = $getSelection();
            if (currentSelection === null) {
              return;
            }
            const currentPoints = currentSelection.getStartEndPoints();
            if (currentPoints === null) {
              return;
            }
            let [currStart, currEnd] = currentPoints;
            if (currentSelection.isBackward()) [currStart, currEnd] = [currEnd, currStart];

            const focusNode = currEnd.getNode() as TextNode;
            const focusOffset = currEnd.offset;

            // Fix: 自动替换的节点无法获取，找到真实节点
            let realAnchorNode: TextNode | null = null;
            if (needFix) {
              const root = $getRoot();
              const topNode = root.getChildren()[topNodeIndex] as ParagraphNodeX;
              realAnchorNode = topNode.getFirstChild();
            }
            const selection = $createRangeSelection();
            if (realAnchorNode) {
              selection.setTextNodeRange(realAnchorNode, 0, focusNode, focusOffset);
            } else {
              selection.setTextNodeRange(anchorNode, anchorOffset, focusNode, focusOffset);
            }

            submitAddSource({ selection });
          });
        });
      }
    },
    [submitAddSource, createMark, editor],
  );

  useEffect(() => {
    const changedElems: Array<HTMLElement> = [];
    for (let i = 0; i < activeIDs.length; i++) {
      const id = activeIDs[i];
      const keys = markNodeXMap.get(id);
      if (keys !== undefined) {
        for (const key of keys) {
          const elem = editor.getElementByKey(key);
          if (elem !== null) {
            elem.classList.add('selected');
            changedElems.push(elem);
          }
        }
      }
    }
    return () => {
      for (let i = 0; i < changedElems.length; i++) {
        const changedElem = changedElems[i];
        changedElem.classList.remove('selected');
      }
    };
  }, [activeIDs, editor, markNodeXMap]);

  useEffect(() => {
    const markNodeXKeysToIDs: Map<NodeKey, Array<string>> = new Map();

    return mergeRegister(
      registerNestedElementResolver<MarkNodeX>(
        editor,
        MarkNodeX,
        (from: MarkNodeX) => {
          return $createMarkNodeX(from.getIDs());
        },
        (from: MarkNodeX, to: MarkNodeX) => {
          // Merge the IDs
          const ids = from.getIDs();
          ids.forEach((id) => {
            to.addID(id);
          });
        },
      ),
      editor.registerMutationListener(MarkNodeX, (mutations) => {
        editor.getEditorState().read(() => {
          for (const [key, mutation] of mutations) {
            const node: null | MarkNodeX = $getNodeByKey(key);
            let ids: NodeKey[] = [];

            if (mutation === 'destroyed') {
              ids = markNodeXKeysToIDs.get(key) || [];
            } else if ($isMarkNodeX(node)) {
              ids = node.getIDs();
            }

            for (let i = 0; i < ids.length; i++) {
              const id = ids[i];
              let markNodeXKeys = markNodeXMap.get(id);
              markNodeXKeysToIDs.set(key, ids);

              if (mutation === 'destroyed') {
                if (markNodeXKeys !== undefined) {
                  markNodeXKeys.delete(key);
                  if (markNodeXKeys.size === 0) {
                    markNodeXMap.delete(id);
                  }
                }
              } else {
                if (markNodeXKeys === undefined) {
                  markNodeXKeys = new Set();
                  markNodeXMap.set(id, markNodeXKeys);
                }
                if (!markNodeXKeys.has(key)) {
                  markNodeXKeys.add(key);
                }
              }
            }
          }
        });
      }),
      editor.registerUpdateListener(({ editorState, tags }) => {
        editorState.read(() => {
          const selection = $getSelection();
          let hasActiveIds = false;
          let hasAnchorKey = false;

          if ($isRangeSelection(selection)) {
            const anchorNode = selection.anchor.getNode();

            if ($isTextNode(anchorNode)) {
              const ids = $getMarkIDs(anchorNode, selection.anchor.offset);
              if (ids !== null) {
                setActiveIDs(ids);
                hasActiveIds = true;
              }
              if (!selection.isCollapsed()) {
                setActiveAnchorKey(anchorNode.getKey());
                hasAnchorKey = true;
              }
            }
          }
          if (!hasActiveIds) {
            setActiveIDs((_activeIds) => (_activeIds.length === 0 ? _activeIds : []));
          }
          if (!hasAnchorKey) {
            setActiveAnchorKey(null);
          }
        });
      }),
      editor.registerCommand(
        INSERT_INLINE_COMMAND,
        () => {
          const domSelection = window.getSelection();
          if (domSelection !== null) {
            domSelection.removeAllRanges();
          }
          setShowSourceInput(true);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
      editor.registerCommand<MouseEvent>(
        CLICK_COMMAND,
        (payload) => {
          if (editor.isEditable()) {
            return false;
          }

          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            if (selection.getTextContent().length > 0) {
              return false;
            }
            const node = getSelectedNode(selection);
            const markNodeX = $findMatchingParent(node, $isMarkNodeX);
            if ($isMarkNodeX(markNodeX)) {
              setTimeout(() => {
                editor.getEditorState().read(() => {
                  setSelectCopusList(markNodeX.getIDs());
                });
              });
            }
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        PASTE_COMMAND,
        (e: ClipboardEvent) => {
          e.stopPropagation();
          const { clipboardData } = e;
          let copyDate = null;
          if (clipboardData && clipboardData.types) {
            clipboardData.types.forEach((type) => {
              if (type === 'application/x-copus-copy') {
                copyDate = clipboardData.getData(type);
              }
            });
          }

          try {
            if (copyDate) {
              const jsonData = JSON.parse(copyDate);
              handlCopyData(jsonData);
            }
          } catch (error) {}

          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, markNodeXMap]);

  useEffect(() => {
    const handleClick = () => {
      setSelectCopusList(undefined);
    };

    window.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <>
      {showSourceInput &&
        createPortal(
          <SourceInputBox editor={editor} cancelAddSource={cancelAddSource} submitAddSource={submitAddSource} />,
          document.body,
        )}
      {selectCopusList &&
        createPortal(
          <CopusList editor={editor} getMarkInfo={getMarkInfo} selectCopusList={selectCopusList} />,
          document.body,
        )}
    </>
  );
}

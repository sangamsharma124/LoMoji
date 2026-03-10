import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * MotionPathEditor
 *
 * Renders an SVG overlay on top of the canvas that shows:
 *  - Dashed bezier motion path for a selected object's position keyframes
 *  - Circular keyframe position handles (draggable)
 *  - Bezier tangent control handles (draggable) on each side of each keyframe
 *
 * Props:
 *   selectedObject  – the currently selected canvas object
 *   keyframes       – the full keyframes state map
 *   currentFrame    – current playback frame number
 *   canvasOffset    – {x, y} canvas pan offset
 *   canvasZoom      – canvas zoom scale
 *   canvasWidth     – physical canvas width (px)
 *   canvasHeight    – physical canvas height (px)
 *   onUpdateKeyframePosition – (objectId, frame, newX, newY) → called when handle dragged
 *   onUpdateControlHandles  – (objectId, frame, cp1, cp2) → called when bezier control point moved
 *   visible         – bool, whether to show the overlay
 */
const MotionPathEditor = ({
    selectedObject,
    keyframes,
    currentFrame,
    canvasOffset,
    canvasZoom,
    canvasWidth,
    canvasHeight,
    onUpdateKeyframePosition,
    onUpdateControlHandles,
    visible = true,
}) => {
    const svgRef = useRef(null);
    const [dragging, setDragging] = useState(null); // { type: 'keyframe'|'cp1'|'cp2', frame, startPos }

    if (!visible || !selectedObject) return null;

    const objId = selectedObject.id;
    const posKfs = keyframes[objId]?.position;
    if (!posKfs || posKfs.length < 2) return null;

    const sorted = [...posKfs].sort((a, b) => a.frame - b.frame);

    // Convert canvas world coords → SVG overlay coords
    const toScreen = (x, y) => ({
        sx: x * canvasZoom + canvasOffset.x,
        sy: y * canvasZoom + canvasOffset.y,
    });

    // Build SVG path string using cubic-bezier between each consecutive pair of keyframes
    // Each keyframe has optional cp1 / cp2 (control points in canvas world coords)
    const buildPath = () => {
        const pts = sorted.map((kf) => {
            const { sx, sy } = toScreen(kf.value.x, kf.value.y);
            return { sx, sy, kf };
        });

        let d = `M ${pts[0].sx} ${pts[0].sy}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const A = pts[i];
            const B = pts[i + 1];
            // Use stored control points or auto-generate smooth ones
            const cp1x = A.kf.cp2
                ? toScreen(A.kf.cp2.x, A.kf.cp2.y).sx
                : A.sx + (B.sx - A.sx) * 0.4;
            const cp1y = A.kf.cp2
                ? toScreen(A.kf.cp2.x, A.kf.cp2.y).sy
                : A.sy + (B.sy - A.sy) * 0.4;
            const cp2x = B.kf.cp1
                ? toScreen(B.kf.cp1.x, B.kf.cp1.y).sx
                : A.sx + (B.sx - A.sx) * 0.6;
            const cp2y = B.kf.cp1
                ? toScreen(B.kf.cp1.x, B.kf.cp1.y).sy
                : A.sy + (B.sy - A.sy) * 0.6;
            d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${B.sx} ${B.sy}`;
        }
        return d;
    };

    // Get screen coords from canvas event
    const getSVGPoint = (e) => {
        const rect = svgRef.current.getBoundingClientRect();
        return {
            sx: e.clientX - rect.left,
            sy: e.clientY - rect.top,
        };
    };

    // Convert screen (SVG) coords back to canvas world coords
    const toWorld = (sx, sy) => ({
        wx: (sx - canvasOffset.x) / canvasZoom,
        wy: (sy - canvasOffset.y) / canvasZoom,
    });

    // ── Drag handlers ──────────────────────────────────────
    const handleKfMouseDown = (e, frame) => {
        e.stopPropagation();
        e.preventDefault();
        const { sx, sy } = getSVGPoint(e);
        setDragging({ type: 'keyframe', frame, startSx: sx, startSy: sy });
    };

    const handleCPMouseDown = (e, frame, cpType) => {
        e.stopPropagation();
        e.preventDefault();
        const { sx, sy } = getSVGPoint(e);
        setDragging({ type: cpType, frame, startSx: sx, startSy: sy });
    };

    const handleMouseMove = useCallback((e) => {
        if (!dragging) return;
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return;
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const { wx, wy } = toWorld(sx, sy);

        if (dragging.type === 'keyframe') {
            onUpdateKeyframePosition?.(objId, dragging.frame, wx, wy);
        } else {
            // cp1 or cp2
            const kf = sorted.find((k) => k.frame === dragging.frame);
            if (!kf) return;
            const newCp1 = dragging.type === 'cp1' ? { x: wx, y: wy } : kf.cp1;
            const newCp2 = dragging.type === 'cp2' ? { x: wx, y: wy } : kf.cp2;
            onUpdateControlHandles?.(objId, dragging.frame, newCp1, newCp2);
        }
    }, [dragging, toWorld, objId, sorted, onUpdateKeyframePosition, onUpdateControlHandles]);

    const handleMouseUp = useCallback(() => {
        setDragging(null);
    }, []);

    useEffect(() => {
        if (dragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragging, handleMouseMove, handleMouseUp]);

    const pathD = buildPath();

    return (
        <svg
            ref={svgRef}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 5,
                overflow: 'visible',
            }}
        >
            <defs>
                <filter id="mp-glow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Shadow / glow path */}
            <path
                d={pathD}
                fill="none"
                stroke="rgba(59, 130, 246, 0.25)"
                strokeWidth={6}
                strokeLinecap="round"
            />

            {/* Main dashed path */}
            <path
                d={pathD}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="7 4"
                strokeLinecap="round"
                style={{ animation: 'dashMove 1.2s linear infinite' }}
            />

            {/* Per-keyframe handles */}
            {sorted.map((kf, i) => {
                const { sx, sy } = toScreen(kf.value.x, kf.value.y);
                const isCurrentFrame = Math.round(currentFrame) === kf.frame;
                const isFirst = i === 0;
                const isLast = i === sorted.length - 1;

                // Control point positions (outgoing cp2 and incoming cp1)
                const cp2Pos = kf.cp2 ? toScreen(kf.cp2.x, kf.cp2.y) : null;
                const cp1Pos = kf.cp1 ? toScreen(kf.cp1.x, kf.cp1.y) : null;

                // Auto control points if not set
                const getAutoCP = (dir) => {
                    if (i === 0 && dir === 'out' && sorted[1]) {
                        const next = toScreen(sorted[1].value.x, sorted[1].value.y);
                        return { sx: sx + (next.sx - sx) * 0.4, sy: sy + (next.sy - sy) * 0.4 };
                    }
                    if (i === sorted.length - 1 && dir === 'in' && sorted[i - 1]) {
                        const prev = toScreen(sorted[i - 1].value.x, sorted[i - 1].value.y);
                        return { sx: sx + (prev.sx - sx) * 0.4, sy: sy + (prev.sy - sy) * 0.4 };
                    }
                    if (dir === 'out' && sorted[i + 1]) {
                        const next = toScreen(sorted[i + 1].value.x, sorted[i + 1].value.y);
                        return { sx: sx + (next.sx - sx) * 0.4, sy: sy + (next.sy - sy) * 0.4 };
                    }
                    if (dir === 'in' && sorted[i - 1]) {
                        const prev = toScreen(sorted[i - 1].value.x, sorted[i - 1].value.y);
                        return { sx: sx + (prev.sx - sx) * 0.4, sy: sy + (prev.sy - sy) * 0.4 };
                    }
                    return null;
                };

                const outCP = cp2Pos || (!isLast ? getAutoCP('out') : null);
                const inCP = cp1Pos || (!isFirst ? getAutoCP('in') : null);

                return (
                    <g key={kf.frame} style={{ pointerEvents: 'all' }}>
                        {/* Tangent lines */}
                        {outCP && (
                            <line
                                x1={sx} y1={sy} x2={outCP.sx} y2={outCP.sy}
                                stroke="rgba(59, 130, 246, 0.5)"
                                strokeWidth={1}
                                strokeDasharray="3 2"
                            />
                        )}
                        {inCP && (
                            <line
                                x1={sx} y1={sy} x2={inCP.sx} y2={inCP.sy}
                                stroke="rgba(59, 130, 246, 0.5)"
                                strokeWidth={1}
                                strokeDasharray="3 2"
                            />
                        )}

                        {/* Outgoing control point handle */}
                        {outCP && (
                            <circle
                                cx={outCP.sx} cy={outCP.sy} r={5}
                                fill="white"
                                stroke="#3b82f6"
                                strokeWidth={1.5}
                                style={{ cursor: 'move' }}
                                onMouseDown={(e) => handleCPMouseDown(e, kf.frame, 'cp2')}
                            />
                        )}

                        {/* Incoming control point handle */}
                        {inCP && (
                            <circle
                                cx={inCP.sx} cy={inCP.sy} r={5}
                                fill="white"
                                stroke="#3b82f6"
                                strokeWidth={1.5}
                                style={{ cursor: 'move' }}
                                onMouseDown={(e) => handleCPMouseDown(e, kf.frame, 'cp1')}
                            />
                        )}

                        {/* Keyframe circle handle */}
                        <circle
                            cx={sx} cy={sy}
                            r={isCurrentFrame ? 8 : 6}
                            fill={isCurrentFrame ? '#3b82f6' : 'white'}
                            stroke="#3b82f6"
                            strokeWidth={isCurrentFrame ? 0 : 2}
                            style={{
                                cursor: 'move',
                                filter: isCurrentFrame ? 'drop-shadow(0 0 6px rgba(59,130,246,0.7))' : 'none',
                                transition: 'r 0.15s ease',
                            }}
                            onMouseDown={(e) => handleKfMouseDown(e, kf.frame)}
                        />

                        {/* Frame label */}
                        <text
                            x={sx + 10} y={sy - 10}
                            fill="#3b82f6"
                            fontSize={10}
                            fontFamily="monospace"
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                            {kf.frame}
                        </text>
                    </g>
                );
            })}

            <style>{`
        @keyframes dashMove {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -22; }
        }
      `}</style>
        </svg>
    );
};

export default MotionPathEditor;

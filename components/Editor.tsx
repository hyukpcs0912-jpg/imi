import React, { useState, useRef, useEffect } from 'react';
import { Type, Move, Trash2, AlignLeft, AlignCenter, AlignRight, Bold, Download, RefreshCw, Plus, ArrowLeft, PenTool, Info, CheckCircle2 } from 'lucide-react';
import { TextLayer, COLORS, FONTS, CopySuggestion } from '../types';
import { Button } from './Button';

interface EditorProps {
  images: string[];
  initialSelectedIndex?: number;
  initialCopies: CopySuggestion[];
  onBack: () => void;
  onRegenerate: () => void;
}

// Canvas Text Wrapping Helper
const getWrappedLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  // 1. Handle explicit newlines first
  const paragraphs = text.split('\n');

  paragraphs.forEach(paragraph => {
      // If no maxWidth is set or it's very small, just return the paragraph
      if (!maxWidth || maxWidth <= 0) {
          lines.push(paragraph);
          return;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      words.forEach((word, index) => {
          // Calculate width of currentLine + space + word
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const metrics = ctx.measureText(testLine);

          if (metrics.width > maxWidth && index > 0) {
               // Case A: The line became too long with the new word.
               // Push the current line and start a new one with the current word.
               lines.push(currentLine);
               currentLine = word;
               
               // Check if the single word is still too long (e.g., long CJK string without spaces)
               if (ctx.measureText(word).width > maxWidth) {
                   // Force split the long word
                   const chars = word.split('');
                   let tempLine = '';
                   chars.forEach((char) => {
                       if (ctx.measureText(tempLine + char).width > maxWidth) {
                           lines.push(tempLine);
                           tempLine = char;
                       } else {
                           tempLine += char;
                       }
                   });
                   currentLine = tempLine;
               }
          } else if (ctx.measureText(testLine).width > maxWidth && index === 0) {
               // Case B: The FIRST word is already too long (very long word/CJK)
               // Force split character by character
               const chars = word.split('');
               let tempLine = '';
               chars.forEach((char) => {
                   if (ctx.measureText(tempLine + char).width > maxWidth) {
                       lines.push(tempLine);
                       tempLine = char;
                   } else {
                       tempLine += char;
                   }
               });
               currentLine = tempLine;
          } else {
               // Case C: Fits normally
               currentLine = testLine;
          }
      });
      if (currentLine) lines.push(currentLine);
  });
  return lines;
};

// Tooltip content helper
const getCopywriterInfo = (styleName: string) => {
  if (styleName.includes("Donald Miller")) return "고객이 주인공이 되는 스토리텔링 마케팅의 대가";
  if (styleName.includes("David Ogilvy")) return "철저한 리서치와 사실(Fact)로 신뢰를 얻는 광고의 아버지";
  if (styleName.includes("Eugene Schwartz")) return "고객의 잠재된 욕구를 정확히 꿰뚫는 전설적인 카피라이터";
  if (styleName.includes("Gary Halbert")) return "편지 쓰듯 친근하지만 강력한 후킹을 구사하는 마케팅 천재";
  if (styleName.includes("Claude Hopkins")) return "데이터와 테스트를 중시하는 과학적 광고의 선구자";
  return "AI가 제안하는 최적화된 마케팅 문구 스타일";
};

export const Editor: React.FC<EditorProps> = ({ images, initialSelectedIndex = 0, initialCopies, onBack, onRegenerate }) => {
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(initialSelectedIndex);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const imageSrc = images[currentImageIndex];

  // ... (rest of the state and hooks)
  
  // Interaction states
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Initialize with the first suggested copy
  useEffect(() => {
    if (initialCopies.length > 0 && textLayers.length === 0) {
      addTextLayer(initialCopies[0].text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCopies]);

  const addTextLayer = (text: string = "새로운 텍스트") => {
    // Default safe values that fit within most images
    const newLayer: TextLayer = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      x: 50, 
      y: 50,
      fontSize: 30, // Updated to 30px
      color: '#FFFFFF',
      fontFamily: "'Noto Sans KR', sans-serif",
      fontWeight: '700',
      width: 300, // Reduced width to ensure it fits better in narrow (mobile) ratios
      align: 'center'
    };
    setTextLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
  };

  const updateLayer = (id: string, updates: Partial<TextLayer>) => {
    setTextLayers(prev => prev.map(layer => layer.id === id ? { ...layer, ...updates } : layer));
  };

  const deleteLayer = (id: string) => {
    setTextLayers(prev => prev.filter(layer => layer.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setIsDragging(true);
    
    const layer = textLayers.find(l => l.id === id);
    if (layer && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        setDragOffset({
            x: mouseX - layer.x,
            y: mouseY - layer.y
        });
    }
  };

  const handleResizeStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection
    setSelectedId(id);
    setIsResizing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (isResizing && selectedId) {
        const layer = textLayers.find(l => l.id === selectedId);
        if (layer) {
            // Calculate new width based on mouse position relative to layer start
            // Min width 50px
            const newWidth = Math.max(50, mouseX - layer.x);
            updateLayer(selectedId, { width: newWidth });
        }
        return;
    }

    if (isDragging && selectedId) {
        updateLayer(selectedId, {
          x: mouseX - dragOffset.x,
          y: mouseY - dragOffset.y
        });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Click outside to deselect
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
        setSelectedId(null);
    }
  }

  const selectedLayer = textLayers.find(l => l.id === selectedId);

  const handleDownload = async () => {
      if (!canvasRef.current) return;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
      
      img.onload = () => {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          
          if (!ctx) return;
          
          // Draw Image
          ctx.drawImage(img, 0, 0);
          
          // Draw Text
          const previewRect = canvasRef.current!.getBoundingClientRect();
          const scaleX = img.naturalWidth / previewRect.width;
          const scaleY = img.naturalHeight / previewRect.height;
          
          textLayers.forEach(layer => {
              ctx.save();
              ctx.font = `${layer.fontWeight} ${layer.fontSize * scaleX}px ${layer.fontFamily.replace(/['"]/g, '')}`;
              ctx.fillStyle = layer.color;
              ctx.textBaseline = 'top';
              ctx.textAlign = layer.align || 'left';
              
              // Shadow to match CSS
              ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
              ctx.shadowBlur = 4;
              ctx.shadowOffsetY = 2;
              
              const lineHeight = layer.fontSize * scaleX * 1.2;
              const boxWidth = (layer.width || 0) * scaleX;
              
              // Get wrapped lines
              const lines = getWrappedLines(ctx, layer.text, boxWidth);
              
              // Simple X adjustment for alignment anchor point
              let drawX = layer.x * scaleX;
              
              if (layer.align === 'center') {
                  drawX += boxWidth / 2;
              } else if (layer.align === 'right') {
                  drawX += boxWidth;
              }

              lines.forEach((line, i) => {
                  ctx.fillText(line, drawX, (layer.y * scaleY) + (i * lineHeight));
              });
              ctx.restore();
          });
          
          const link = document.createElement('a');
          link.download = 'commerce-wizard-result.jpg';
          link.href = canvas.toDataURL('image/jpeg', 0.9);
          link.click();
      };
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden text-white" onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}>
      
      {/* Sidebar Controls */}
      <div className="w-80 bg-gray-900/80 backdrop-blur-xl border-r border-white/10 flex flex-col z-20 shadow-2xl select-none">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
            <h2 className="font-bold text-white flex items-center gap-2">
                <Move className="w-5 h-5 text-blue-400"/>
                에디터
            </h2>
            <button onClick={onBack} className="text-sm text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Image Selection */}
          <div className="space-y-3">
             <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <Move className="w-3 h-3"/>
                배경 이미지 선택
             </label>
             <div className="grid grid-cols-2 gap-2">
                {images.map((img, idx) => (
                    <div 
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                            currentImageIndex === idx ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent hover:border-white/20'
                        }`}
                    >
                        <img src={img} alt={`Option ${idx + 1}`} className="w-full h-full object-cover" />
                        {currentImageIndex === idx && (
                            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                <div className="bg-blue-500 rounded-full p-1">
                                    <CheckCircle2 className="w-3 h-3 text-white" />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
             </div>
          </div>

          <hr className="border-white/5"/>

          {/* AI Suggestions */}
          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <PenTool className="w-3 h-3"/>
                    AI 카피라이터 제안
                </label>
                <button onClick={onRegenerate} className="p-1 hover:bg-white/5 rounded-full transition-colors" title="배경 다시 생성 (전 단계로 이동)">
                    <RefreshCw className="w-3 h-3 text-gray-500" />
                </button>
             </div>
             <div className="grid gap-3">
                {initialCopies.map((copyItem, idx) => (
                    <div 
                        key={idx} 
                        onClick={() => addTextLayer(copyItem.text)}
                        className="p-3 bg-white/5 hover:bg-blue-500/10 border border-white/10 hover:border-blue-500/30 rounded-lg cursor-pointer transition-all group shadow-sm relative"
                    >
                        <div className="group/tooltip inline-block relative">
                            <div className="text-[10px] font-bold text-blue-400 mb-1 bg-blue-500/10 w-fit px-1.5 py-0.5 rounded group-hover:bg-blue-500/20 flex items-center gap-1 cursor-help">
                                {copyItem.style}
                            </div>
                            {/* Tooltip */}
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2.5 bg-gray-800 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none text-left leading-relaxed border border-white/10">
                                <p className="font-semibold text-blue-300 mb-0.5 border-b border-white/5 pb-0.5">{copyItem.style.split(' ')[0]} {copyItem.style.split(' ')[1]}</p>
                                {getCopywriterInfo(copyItem.style)}
                                <div className="absolute left-2 top-full w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-gray-800"></div>
                            </div>
                        </div>
                        <div className="text-sm text-gray-300 leading-snug whitespace-pre-wrap group-hover:text-white transition-colors">
                            {copyItem.text}
                        </div>
                    </div>
                ))}
             </div>
          </div>

          <hr className="border-white/5"/>

          {/* Selected Layer Properties */}
          {selectedLayer ? (
            <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                     <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">텍스트 속성</label>
                     <button onClick={() => deleteLayer(selectedLayer.id)} className="text-red-400 hover:text-red-300 p-1 transition-colors">
                         <Trash2 className="w-4 h-4" />
                     </button>
                </div>

                <div className="space-y-2">
                    <label className="text-sm text-gray-400">내용</label>
                    <textarea 
                        value={selectedLayer.text}
                        onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                        className="w-full p-2 bg-white/5 border border-white/10 rounded-md text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-20 transition-all"
                    />
                </div>

                {/* Alignment */}
                <div className="space-y-2">
                     <label className="text-sm text-gray-400">정렬</label>
                     <div className="flex bg-white/5 rounded-lg p-1 w-fit border border-white/5">
                        <button 
                            onClick={() => updateLayer(selectedLayer.id, { align: 'left' })}
                            className={`p-1.5 rounded transition-all ${(!selectedLayer.align || selectedLayer.align === 'left') ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <AlignLeft className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => updateLayer(selectedLayer.id, { align: 'center' })}
                            className={`p-1.5 rounded transition-all ${selectedLayer.align === 'center' ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <AlignCenter className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => updateLayer(selectedLayer.id, { align: 'right' })}
                            className={`p-1.5 rounded transition-all ${selectedLayer.align === 'right' ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <AlignRight className="w-4 h-4" />
                        </button>
                     </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-sm text-gray-400">폰트 크기</label>
                        <input 
                            type="number" 
                            value={selectedLayer.fontSize}
                            onChange={(e) => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                            className="w-full p-2 bg-white/5 border border-white/10 rounded-md text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                     <div className="space-y-1">
                        <label className="text-sm text-gray-400">폰트 종류</label>
                        <select 
                            value={selectedLayer.fontFamily}
                            onChange={(e) => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}
                            className="w-full p-2 bg-gray-800 border border-white/10 rounded-md text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {FONTS.map(f => (
                                <option key={f.name} value={f.value}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm text-gray-400">색상</label>
                    <div className="flex flex-wrap gap-2">
                        {COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => updateLayer(selectedLayer.id, { color: c })}
                                className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 ${selectedLayer.color === c ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-blue-500' : 'border-white/20'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                     <label className="text-sm text-gray-400">스타일</label>
                     <div className="flex gap-2">
                        <button 
                            onClick={() => updateLayer(selectedLayer.id, { fontWeight: selectedLayer.fontWeight === '700' ? '400' : '700' })}
                            className={`p-2 rounded border transition-all ${selectedLayer.fontWeight === '700' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                        >
                            <Bold className="w-4 h-4" />
                        </button>
                     </div>
                </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-600">
                <Type className="w-12 h-12 mx-auto mb-2 opacity-10" />
                <p className="text-sm">텍스트를 선택하여 편집하세요</p>
            </div>
          )}
          
          <Button variant="outline" className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10" onClick={() => addTextLayer()}>
            <Plus className="w-4 h-4 mr-2"/>
            텍스트 추가
          </Button>

        </div>

        <div className="p-4 border-t border-white/5 bg-black/20">
            <Button className="w-full shadow-lg shadow-blue-500/20" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                이미지 다운로드
            </Button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 bg-gray-950 flex items-center justify-center p-8 relative overflow-hidden">
         {/* Grid background */}
         <div className="absolute inset-0 opacity-20" 
              style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
         </div>

         <div 
            ref={canvasRef}
            className="relative shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-black select-none ring-1 ring-white/10"
            style={{ maxHeight: '90vh', maxWidth: '90vw', aspectRatio: 'auto' }} // Preserve aspect ratio naturally by image
            onMouseDown={handleCanvasClick}
         >
            <img 
                src={imageSrc} 
                alt="Generated Background" 
                className="max-h-[85vh] w-auto h-auto object-contain pointer-events-none block"
                draggable={false}
            />
            
            {textLayers.map(layer => (
                <div
                    key={layer.id}
                    onMouseDown={(e) => handleMouseDown(e, layer.id)}
                    className={`absolute group leading-tight
                        ${selectedId === layer.id ? 'ring-2 ring-blue-500 ring-dashed cursor-move' : 'hover:ring-1 hover:ring-blue-300 hover:ring-dashed cursor-pointer'}`}
                    style={{
                        left: layer.x,
                        top: layer.y,
                        width: layer.width || 'auto', // Use explicit width if set
                        fontSize: `${layer.fontSize}px`,
                        color: layer.color,
                        fontFamily: layer.fontFamily,
                        fontWeight: layer.fontWeight,
                        textAlign: layer.align || 'left',
                        zIndex: 10,
                        textShadow: '0px 2px 4px rgba(0,0,0,0.2)',
                        whiteSpace: 'pre-wrap' // Allow wrapping within the width
                    }}
                >
                    {layer.text}
                    
                    {/* Position Label */}
                    {selectedId === layer.id && (
                        <div className="absolute -top-6 left-0 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
                            {Math.round(layer.width || 0)}px
                        </div>
                    )}

                    {/* Resize Handle */}
                    {selectedId === layer.id && (
                        <div 
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full cursor-e-resize z-20 shadow-sm flex items-center justify-center"
                            onMouseDown={(e) => handleResizeStart(e, layer.id)}
                        >
                             <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                        </div>
                    )}
                </div>
            ))}
         </div>
      </div>
    </div>
  );
};
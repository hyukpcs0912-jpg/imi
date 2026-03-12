import React, { useState, useEffect } from 'react';
import { ImageUploader } from './components/Imageuploader';
import { Editor } from './components/Editor';
import { AppState, GeneratedResult, AspectRatio } from './types';
import { analyzeProductAndSuggest, generateProductBackground, fileToBase64 } from './services/geminiService';
import { Wand2, Loader2, AlertCircle, Square, RectangleHorizontal, RectangleVertical, Smartphone, Copy, CheckCircle2, Zap } from 'lucide-react';
import { Button } from './components/Button';

// Use a local file for the logo as requested. 
// If the file is missing, the onError handler will fallback to the placeholder.
const LOGO_URL = "/logo.png";
const FALLBACK_LOGO_URL = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80";

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [specialRequest, setSpecialRequest] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  
  // AI Studio Key State
  const [hasApiKey, setHasApiKey] = useState(false);
  const [manualApiKey, setManualApiKey] = useState("");
  const [useManualKey, setUseManualKey] = useState(false);
  const [isManualKeyConfirmed, setIsManualKeyConfirmed] = useState(false);

  useEffect(() => {
    checkApiKey();
    // Re-check on window focus to catch external changes
    const onFocus = () => checkApiKey();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const checkApiKey = async () => {
    if (window.aistudio) {
      try {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } catch (e) {
        console.error("Error checking API key:", e);
      }
    }
  };

  const handleConnectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        
        // Polling to detect changes after dialog interaction
        // Sometimes the state update is not immediate
        await checkApiKey();
        const intervalId = setInterval(checkApiKey, 500);
        
        // Stop polling after 5 seconds
        setTimeout(() => clearInterval(intervalId), 5000);
      } catch (e) {
        console.error("Key selection failed", e);
      }
    } else {
        alert("이 기능은 Google AI Studio 환경에서만 동작합니다.");
    }
  };

  const handleImageSelect = (file: File) => {
    setError(null);
    setDetailedError(null);
    setShowErrorDetails(false);
    setSelectedFile(file);
  };

  const handleStart = async () => {
    if (!selectedFile) return;
    
    // Determine which key to use
    let activeKey = process.env.API_KEY;
    
    // If manual key is provided and confirmed, use it
    if (isManualKeyConfirmed && manualApiKey) {
        activeKey = manualApiKey;
    }

    // Double check connection status
    if (!activeKey) {
        // Try to re-sync status if key is missing (only for AI Studio flow)
        if (!isManualKeyConfirmed) {
            await checkApiKey();
            if (!hasApiKey) {
                 setError("API Key를 찾을 수 없습니다. 다시 연결해주세요.");
                 return;
            }
        }
        
        // If still no key
        if (!activeKey) {
             setError("API Key가 입력되지 않았습니다. API Key를 연결하거나 직접 입력해주세요.");
             return;
        }
    }

    try {
      const base64 = await fileToBase64(selectedFile);
      setOriginalImage(base64);
      setAppState(AppState.PROCESSING);
      await processImage(base64, activeKey, specialRequest);
    } catch (err: any) {
      console.error(err);
      handleError(err);
      setAppState(AppState.UPLOAD);
    }
  };

  const processImage = async (base64: string, currentApiKey: string, userRequest: string = "") => {
    try {
      setLoadingStep("AI가 제품을 분석하고 최적의 컨셉을 구상 중입니다...");
      const analysis = await analyzeProductAndSuggest(currentApiKey, base64, userRequest);
      
      setLoadingStep(`4가지 다양한 컨셉으로 배경을 합성 중입니다...`);
      const generatedBgs = await generateProductBackground(currentApiKey, base64, analysis.backgroundPrompts, aspectRatio);

      setResult({
        originalImage: base64,
        generatedImages: generatedBgs,
        suggestedCopy: analysis.copies,
        productAnalysis: analysis.backgroundPrompts.join('\n\n')
      });

      setAppState(AppState.SELECTION);
    } catch (err: any) {
      console.error("Process Image Error:", err);
      handleError(err);
      setAppState(AppState.UPLOAD);
    }
  };

  const handleError = (err: any) => {
    console.error("Error details:", err); // Keep logging to console for debugging
    
    // Simplified error handling that hides technical details from the UI
    const errorMessage = err?.message || "Unknown error";
    
    if (errorMessage.includes("quota") || errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      setError(
        <span className="text-left block">
          <span className="font-bold">⚠️ 사용량 초과</span><br/>
          잠시 후 다시 시도해주세요.
        </span>
      );
    } else {
      // Generic friendly message instead of raw error
      setError("작업을 처리하는 도중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
    
    // Show detailed error logs from UI
    setDetailedError(err?.stack || errorMessage);
  };

  const handleRegenerate = async () => {
      let activeKey = process.env.API_KEY;
      if (isManualKeyConfirmed && manualApiKey) {
          activeKey = manualApiKey;
      }

      if(originalImage && activeKey) {
        setAppState(AppState.PROCESSING);
        await processImage(originalImage, activeKey);
      } else {
          setError("API Key가 누락되었습니다.");
          setAppState(AppState.UPLOAD);
      }
  };

  const ratios: { value: AspectRatio; label: string; icon: React.ReactNode }[] = [
    { value: "1:1", label: "정방형 (1:1)", icon: <Square className="w-5 h-5"/> },
    { value: "3:4", label: "일반 세로 (3:4)", icon: <RectangleVertical className="w-5 h-5"/> },
    { value: "9:16", label: "모바일 (9:16)", icon: <Smartphone className="w-5 h-5"/> },
    { value: "4:3", label: "일반 가로 (4:3)", icon: <RectangleHorizontal className="w-5 h-5"/> },
    { value: "16:9", label: "와이드 (16:9)", icon: <RectangleHorizontal className="w-5 h-5 scale-x-125"/> },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans relative overflow-hidden">
      {/* Background Image with Overlay */}
      {appState !== AppState.EDITOR && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
          style={{ 
            backgroundImage: 'url("https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=2560&q=80")',
            opacity: 0.6
          }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>
        </div>
      )}
      
      {/* Header removed as requested */}

      <main className={`relative z-10 ${appState === AppState.EDITOR ? 'h-screen' : 'max-w-7xl mx-auto px-4 py-12'}`}>
        
        {appState === AppState.UPLOAD && (
          <div className="flex flex-col items-center justify-center space-y-12 animate-fadeIn">
            <div className="text-center space-y-4 max-w-2xl">
              <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl leading-tight drop-shadow-lg">
                이미지 메이킹<br/>
                상세 페이지 완성<br/>
                (캔바대용)
              </h2>
            </div>

            <div className="w-full max-w-xl space-y-8">
                
                {/* Connection Status */}
                {!hasApiKey && !isManualKeyConfirmed ? (
                    useManualKey ? (
                        <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/20 text-center space-y-6">
                            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                                <Zap className="w-8 h-8 text-blue-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-white">API Key 직접 입력</h3>
                                <p className="text-gray-300">
                                    Google AI Studio에서 발급받은 API Key를 입력해주세요.
                                </p>
                            </div>
                            <div className="space-y-3">
                                <input 
                                    type="password" 
                                    value={manualApiKey}
                                    onChange={(e) => setManualApiKey(e.target.value)}
                                    placeholder="AIza..."
                                    className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                                <div className="flex gap-2">
                                    <Button 
                                        onClick={() => setUseManualKey(false)} 
                                        variant="secondary"
                                        className="flex-1 bg-white/10 hover:bg-white/20 border-none text-white"
                                    >
                                        취소
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            if (manualApiKey.trim().length > 0) {
                                                setIsManualKeyConfirmed(true);
                                                setUseManualKey(false); // Hide the form
                                            } else {
                                                alert("API Key를 입력해주세요.");
                                            }
                                        }} 
                                        disabled={!manualApiKey}
                                        className="flex-1 shadow-lg shadow-blue-500/20"
                                    >
                                        확인
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/20 text-center space-y-6">
                            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                                <Zap className="w-8 h-8 text-blue-400" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-white">AI Studio 연결이 필요합니다</h3>
                                <p className="text-gray-300">
                                    서비스를 이용하려면 Google AI Studio API Key를 연결해야 합니다.
                                </p>
                            </div>
                            <div className="space-y-3">
                                <Button 
                                    onClick={handleConnectKey} 
                                    size="lg"
                                    className="w-full shadow-lg shadow-blue-500/20"
                                >
                                    API Key 연결하기
                                </Button>
                                <button 
                                    onClick={() => setUseManualKey(true)}
                                    className="text-sm text-gray-400 underline hover:text-white transition-colors"
                                >
                                    또는 API Key 직접 입력하기
                                </button>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between bg-green-500/10 backdrop-blur-sm p-4 rounded-lg border border-green-500/30">
                             <div className="flex items-center gap-2 text-green-400 font-medium">
                                <CheckCircle2 className="w-5 h-5" />
                                <span>
                                    {isManualKeyConfirmed ? "API Key가 입력되었습니다." : "연결이 완료 되었습니다."}
                                </span>
                             </div>
                             <button 
                                onClick={() => {
                                    handleConnectKey();
                                    setUseManualKey(false);
                                    setIsManualKeyConfirmed(false);
                                    setManualApiKey("");
                                }}
                                className="text-xs text-green-400 underline hover:text-green-300"
                             >
                                {isManualKeyConfirmed ? "다시 입력" : "변경"}
                             </button>
                        </div>

                        {/* Ratio Selector */}
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/20 space-y-4">
                            <label className="text-sm font-semibold text-gray-300 block">생성할 이미지 비율 선택</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {ratios.map((r) => (
                                    <button
                                        key={r.value}
                                        onClick={() => setAspectRatio(r.value)}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                                            aspectRatio === r.value 
                                            ? 'bg-blue-500/20 border-blue-500 text-blue-400 ring-1 ring-blue-500' 
                                            : 'border-white/10 text-gray-400 hover:bg-white/5 hover:border-white/20'
                                        }`}
                                    >
                                        {r.icon}
                                        <span className="text-sm font-medium">{r.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-xl space-y-4">
                          <ImageUploader 
                            onImageSelect={handleImageSelect} 
                            selectedFile={selectedFile}
                            onClear={() => setSelectedFile(null)}
                          />
                          
                          <div className="px-4 pb-4 space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    AI에게 특별히 요청할 사항 (선택)
                                </label>
                                <textarea
                                    value={specialRequest}
                                    onChange={(e) => setSpecialRequest(e.target.value)}
                                    placeholder="예: 따뜻한 봄날의 피크닉 분위기로 만들어줘, 고급스러운 대리석 배경으로 해줘"
                                    className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none h-24"
                                />
                              </div>
                              
                              <div className="pt-2">
                                <Button 
                                  onClick={handleStart}
                                  disabled={!selectedFile}
                                  size="lg"
                                  className={`w-full shadow-lg transition-all duration-300 ${
                                    selectedFile 
                                      ? 'shadow-blue-500/30 bg-blue-600 hover:bg-blue-500 text-white' 
                                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                  }`}
                                >
                                  <Wand2 className={`w-5 h-5 mr-2 ${selectedFile ? 'animate-pulse' : ''}`} />
                                  {selectedFile ? "상세페이지 생성 시작하기" : "이미지를 먼저 선택해주세요"}
                                </Button>
                              </div>
                          </div>
                        </div>
                    </div>
                )}
            </div>

            {error && (
               <div className="w-full max-w-xl animate-fadeIn space-y-2">
                  <div className="flex items-center text-red-400 bg-red-500/10 backdrop-blur-sm px-4 py-3 rounded-lg border border-red-500/30 text-sm">
                      <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                      <div className="flex-1 font-medium">{error}</div>
                      {detailedError && (
                        <button 
                          onClick={() => setShowErrorDetails(!showErrorDetails)}
                          className="ml-2 p-1 hover:bg-red-500/20 rounded text-red-400 underline text-xs whitespace-nowrap"
                        >
                          {showErrorDetails ? "로그 접기" : "로그 보기"}
                        </button>
                      )}
                  </div>
                  
                  {showErrorDetails && detailedError && (
                    <div className="bg-black/80 backdrop-blur-md text-gray-300 p-4 rounded-lg text-xs font-mono overflow-x-auto relative border border-white/10">
                      <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
                        <span className="font-bold text-gray-500">Error Log Detail</span>
                        <button 
                          onClick={() => navigator.clipboard.writeText(detailedError)}
                          className="text-gray-500 hover:text-white flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3"/> 복사
                        </button>
                      </div>
                      <pre className="whitespace-pre-wrap break-all">
                        {detailedError}
                      </pre>
                    </div>
                  )}
               </div>
            )}
            
             <div className="w-full max-w-4xl mt-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
               <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
                 {[
                   { title: "자동 배경 합성", desc: "제품에 딱 맞는 고퀄리티 배경 생성" },
                   { title: "마케팅 카피", desc: "구매 전환율을 높이는 문구 추천" },
                   { title: "쉬운 편집", desc: "드래그 앤 드롭으로 자유로운 수정" }
                 ].map((feature, i) => (
                   <div key={i} className="p-8 text-center hover:bg-white/5 transition-colors group">
                      <div className="font-bold text-lg mb-2 text-white group-hover:text-blue-400 transition-colors">{feature.title}</div>
                      <div className="text-gray-400 text-sm leading-relaxed">{feature.desc}</div>
                   </div>
                 ))}
               </div>
            </div>

          </div>
        )}

        {appState === AppState.PROCESSING && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 animate-fadeIn relative z-20">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping opacity-20"></div>
                <div className="relative bg-white/10 backdrop-blur-md p-6 rounded-full shadow-2xl border border-white/20">
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                </div>
            </div>
            
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-white">AI가 작업 중입니다</h3>
                <p className="text-blue-400 animate-pulse font-medium">{loadingStep}</p>
            </div>

            <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-blue-500 rounded-full animate-progress shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            </div>
            <style>{`
                @keyframes progress {
                    0% { width: 0%; margin-left: 0; }
                    50% { width: 50%; margin-left: 25%; }
                    100% { width: 100%; margin-left: 0; }
                }
                .animate-progress {
                    animation: progress 2s infinite ease-in-out;
                }
            `}</style>
          </div>
        )}

        {appState === AppState.SELECTION && result && (
          <div className="flex flex-col items-center justify-center space-y-8 animate-fadeIn">
             <div className="text-center space-y-2">
                <h3 className="text-3xl font-bold text-white">마음에 드는 이미지를 선택하세요</h3>
                <p className="text-gray-400">선택한 이미지를 바탕으로 상세페이지를 제작합니다.</p>
             </div>

             <div className="grid grid-cols-2 gap-4 w-full max-w-4xl">
                {result.generatedImages.map((img, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      setSelectedImageIndex(idx);
                      setAppState(AppState.EDITOR);
                    }}
                    className="relative group cursor-pointer rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all shadow-2xl"
                  >
                    <img src={img} alt={`Generated ${idx + 1}`} className="w-full h-auto object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-blue-600 text-white px-4 py-2 rounded-full font-bold shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        이걸로 선택하기
                      </span>
                    </div>
                  </div>
                ))}
             </div>
             
             <Button 
                variant="secondary"
                onClick={() => setAppState(AppState.UPLOAD)}
                className="mt-8"
             >
                처음으로 돌아가기
             </Button>
          </div>
        )}

        {appState === AppState.EDITOR && result && (
          <Editor 
            images={result.generatedImages}
            initialSelectedIndex={selectedImageIndex}
            initialCopies={result.suggestedCopy}
            onBack={() => setAppState(AppState.SELECTION)}
            onRegenerate={handleRegenerate}
          />
        )}
      </main>
    </div>
  );
}

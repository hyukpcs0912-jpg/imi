import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from './Button';

interface ImageUploaderProps {
  onImageSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect, selectedFile, onClear }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      onImageSelect(file);
    } else {
      alert("Please upload an image file.");
    }
  };

  if (selectedFile && previewUrl) {
    return (
      <div className="w-full max-w-xl mx-auto p-6 bg-white/5 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10">
        <div className="relative w-full aspect-square md:aspect-video rounded-lg overflow-hidden bg-black/50 mb-4 group">
          <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <Button onClick={onClear} variant="secondary" className="bg-white text-black hover:bg-gray-200">
                이미지 변경하기
             </Button>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-400 px-2">
           <span className="truncate max-w-[200px]">{selectedFile.name}</span>
           <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`w-full max-w-xl mx-auto p-12 bg-white/5 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-dashed transition-all duration-300 ${
        dragActive ? 'border-blue-500 bg-blue-500/10' : 'border-white/10'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-center text-center space-y-6">
        <div className={`p-4 rounded-full ${dragActive ? 'bg-blue-500/20' : 'bg-white/5'}`}>
          <ImageIcon className={`w-12 h-12 ${dragActive ? 'text-blue-400' : 'text-gray-500'}`} />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white">제품 이미지를 업로드하세요</h3>
          <p className="text-gray-400">
            여기로 이미지를 끌어다 놓거나 아래 버튼을 클릭하세요.
          </p>
          <p className="text-xs text-gray-500">
            JPG, PNG, WEBP (최대 10MB)
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleChange}
        />
        
        <Button 
          size="lg" 
          onClick={() => fileInputRef.current?.click()}
          className="shadow-md hover:shadow-lg transform transition-all active:scale-95"
        >
          <Upload className="w-5 h-5 mr-2" />
          이미지 선택하기
        </Button>
      </div>
    </div>
  );
};
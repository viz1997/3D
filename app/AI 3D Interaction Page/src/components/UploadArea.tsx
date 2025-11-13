import { Upload } from 'lucide-react';

interface UploadAreaProps {
  label: string;
  required?: boolean;
  onUpload?: (file: File) => void;
  size?: 'small' | 'medium';
}

export function UploadArea({ label, required = false, onUpload, size = 'medium' }: UploadAreaProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
  };

  const heightClass = size === 'small' ? 'h-32' : 'h-48';
  const iconSize = size === 'small' ? 'w-5 h-5' : 'w-6 h-6';

  return (
    <div className="flex flex-col gap-2">
      <label className={`relative w-full ${heightClass} border-2 border-dashed border-[#2d3548] rounded-lg bg-[#1a1f2e] hover:bg-[#1f2937] cursor-pointer transition-colors flex flex-col items-center justify-center group`}>
        <input
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
        <Upload className={`${iconSize} text-gray-500 group-hover:text-gray-400 mb-1.5`} />
        <span className="text-gray-400 text-xs">{label}</span>
        {required && <span className="text-red-500 text-xs ml-1">*</span>}
      </label>
    </div>
  );
}

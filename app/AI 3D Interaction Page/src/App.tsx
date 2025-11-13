import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Label } from './components/ui/label';
import { Switch } from './components/ui/switch';
import { Textarea } from './components/ui/textarea';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { UploadArea } from './components/UploadArea';
import { Info, Crown, HelpCircle } from 'lucide-react';

export default function App() {
  const [mainTab, setMainTab] = useState('text-to-3d');
  const [imageTab, setImageTab] = useState('single');
  const [selectedModel, setSelectedModel] = useState('3D-V3.0');
  const [modelType, setModelType] = useState('standard');
  const [smartLowPoly, setSmartLowPoly] = useState(false);
  const [publicVisibility, setPublicVisibility] = useState(true);
  const [outputFormat, setOutputFormat] = useState('GLB');
  const [textPrompt, setTextPrompt] = useState('');

  return (
    <div className="min-h-screen bg-[#0f1419] text-white flex">
      {/* Left Panel - Interaction Area (1/3) */}
      <div className="w-1/3 border-r border-[#1f2937] overflow-y-auto">
        <div className="p-6 space-y-5">
          {/* Main Tabs */}
          <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-5 bg-[#1a1f2e] p-1 rounded-lg">
              <TabsTrigger 
                value="text-to-3d"
                className="data-[state=active]:bg-[#2d3548] rounded-md text-gray-400 data-[state=active]:text-white"
              >
                Text to 3D
              </TabsTrigger>
              <TabsTrigger 
                value="image-to-3d"
                className="data-[state=active]:bg-[#2d3548] rounded-md text-gray-400 data-[state=active]:text-white"
              >
                Image to 3D
              </TabsTrigger>
            </TabsList>

            {/* Text to 3D Tab */}
            <TabsContent value="text-to-3d" className="space-y-4 min-h-[320px]">
              <div>
                <Textarea
                  id="text-prompt"
                  placeholder="Describe the 3D model you want to create..."
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  className="min-h-[120px] bg-[#1a1f2e] border-[#2d3548] text-white placeholder:text-gray-500 resize-none focus:border-[#4a5568]"
                />
              </div>
            </TabsContent>

            {/* Image to 3D Tab */}
            <TabsContent value="image-to-3d" className="space-y-4 min-h-[320px]">
              {/* Image Sub-tabs */}
              <div className="flex items-center gap-6 mb-4 border-b border-[#2d3548]">
                <button
                  onClick={() => setImageTab('single')}
                  className={`pb-2 border-b-2 transition-colors text-sm ${
                    imageTab === 'single'
                      ? 'border-white text-white'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Single Image
                </button>
                <button
                  onClick={() => setImageTab('multiple')}
                  className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 text-sm ${
                    imageTab === 'multiple'
                      ? 'border-white text-white'
                      : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Multiple Images
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Single Image Upload */}
              {imageTab === 'single' && (
                <div>
                  <UploadArea label="Upload Image" size="medium" />
                  <p className="text-gray-500 text-xs text-center mt-3">
                    Support jpg/jpeg/png/webp, max 10MB
                  </p>
                </div>
              )}

              {/* Multiple Images Upload */}
              {imageTab === 'multiple' && (
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <UploadArea label="Front View" required size="small" />
                    <UploadArea label="Back View" size="small" />
                    <UploadArea label="Left View" size="small" />
                    <UploadArea label="Right View" size="small" />
                  </div>
                  <div className="flex items-start gap-2 mt-3 text-gray-500 text-xs">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p>Front view is required, others are optional</p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Model Selector Dropdown */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm text-gray-300">Select Model</Label>
              <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-full bg-[#1a1f2e] border-[#2d3548] text-sm text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3D-V3.0">3D-V3.0</SelectItem>
                <SelectItem value="3D-V2.0">3D-V2.0</SelectItem>
                <SelectItem value="3D-V1.0">3D-V1.0</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Model Type Selection */}
          <div className="space-y-2.5">
            <Label className="text-sm text-gray-300">Model Selection</Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setModelType('standard')}
                className={`px-3 py-2 rounded-md border transition-all text-sm ${
                  modelType === 'standard'
                    ? 'border-blue-500 bg-[#1a1f2e] text-white'
                    : 'border-[#2d3548] bg-[#1a1f2e]/50 text-gray-400 hover:border-[#3d4558]'
                }`}
              >
                Standard Texture
              </button>
              <button
                onClick={() => setModelType('white')}
                className={`px-3 py-2 rounded-md border transition-all text-sm ${
                  modelType === 'white'
                    ? 'border-blue-500 bg-[#1a1f2e] text-white'
                    : 'border-[#2d3548] bg-[#1a1f2e]/50 text-gray-400 hover:border-[#3d4558]'
                }`}
              >
                White Model
              </button>
            </div>
          </div>

          {/* Smart Low Poly Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="smart-low-poly" className="cursor-pointer text-sm text-gray-300">
                  Smart Low Poly
                </Label>
                <Crown className="w-3.5 h-3.5 text-yellow-500" />
              </div>
              <Switch
                id="smart-low-poly"
                checked={smartLowPoly}
                onCheckedChange={setSmartLowPoly}
              />
            </div>

            {/* Public Visibility */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="public-visibility" className="cursor-pointer text-sm text-gray-300">
                  Public Visibility
                </Label>
                {!publicVisibility && <Crown className="w-3.5 h-3.5 text-yellow-500" />}
              </div>
              <Switch
                id="public-visibility"
                checked={publicVisibility}
                onCheckedChange={setPublicVisibility}
              />
            </div>
          </div>

          {/* Output Format */}
          <div className="flex items-center justify-between">
            <Label className="text-sm text-gray-300">Output Model Format</Label>
            <Select value={outputFormat} onValueChange={setOutputFormat}>
              <SelectTrigger className="w-24 bg-[#1a1f2e] border-[#2d3548] text-sm h-8 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GLB">GLB</SelectItem>
                <SelectItem value="FBX">FBX</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button 
            className="w-full bg-white hover:bg-gray-200 text-black py-5 mt-6"
            size="lg"
          >
            Create
          </Button>
        </div>
      </div>

      {/* Right Panel - 3D Preview Area (2/3) */}
      <div className="w-2/3 flex items-center justify-center bg-[#161b22]">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#1a1f2e] flex items-center justify-center">
            <div className="w-14 h-14 border-4 border-[#2d3548] border-t-[#4a5568] rounded-full opacity-50"></div>
          </div>
          <p className="text-gray-400 text-sm">3D Preview</p>
          <p className="text-gray-500 text-xs mt-1.5">Preview will appear here after generation</p>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { Play, ChevronRight, Users, Clock, Target, Lightbulb, AlertCircle } from "lucide-react";

export interface EducatorVideo {
  id: string;
  title: string;
  videoUrl: string; // YouTube URL (regular or Shorts)
  isShort: boolean;
  educator?: string;
  thumbnail?: string;
  energyLevel: "Low" | "Medium" | "High";
  ageGroup: string[];
  duration: string;
  indoor: boolean;
  outdoor: boolean;
  guidance: {
    howToConduct: {
      steps: string[];
      duration: string;
      groupSize: string;
      materialsNeeded: string[];
    };
    whatToModel: {
      movements: string[];
      voiceTone: string;
      facialExpressions: string;
    };
    developmentFocus: string[];
  };
}

interface MusicMovementSectionProps {
  videos: EducatorVideo[];
}

export function MusicMovementSection({ videos }: MusicMovementSectionProps) {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const carouselRef = useRef<HTMLDivElement>(null);

  const currentVideo = videos[currentVideoIndex];

  // Filter videos based on selected filter
  const filteredVideos = videos.filter((video) => {
    if (selectedFilter === "All") return true;
    if (selectedFilter === "Low" || selectedFilter === "Medium" || selectedFilter === "High") {
      return video.energyLevel === selectedFilter;
    }
    return true;
  });

  // Convert YouTube URL to embed format
  const getEmbedUrl = (url: string) => {
    if (url.includes('/shorts/')) {
      const videoId = url.split('/shorts/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('watch?v=')) {
      const videoId = url.split('watch?v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('embed/')) {
      return url;
    }
    return url;
  };

  // Scroll carousel to selected video
  const scrollToVideo = (index: number) => {
    setCurrentVideoIndex(index);
    if (carouselRef.current) {
      const videoCard = carouselRef.current.children[index] as HTMLElement;
      if (videoCard) {
        videoCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  };

  const handleNextVideo = () => {
    const nextIndex = (currentVideoIndex + 1) % filteredVideos.length;
    scrollToVideo(nextIndex);
  };

  if (!currentVideo || filteredVideos.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
        <p className="text-center text-muted-foreground">No educator videos available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 lg:p-6 border-b border-blue-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center text-lg">
              🎵
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base lg:text-lg">Music & Movement</h3>
              <p className="text-xs text-muted-foreground">Educator Guidance & Examples</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{filteredVideos.length} Activities</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="lg:grid lg:grid-cols-[300px_1fr] lg:gap-0">
        {/* Desktop: Video List Sidebar */}
        <div className="hidden lg:block border-r border-border bg-muted/5 overflow-y-auto" style={{ maxHeight: '600px' }}>
          <div className="p-4 space-y-2">
            {filteredVideos.map((video, index) => (
              <button
                key={video.id}
                onClick={() => setCurrentVideoIndex(index)}
                className={`w-full text-left p-3 rounded-xl transition-all ${
                  currentVideoIndex === index
                    ? 'bg-blue-100 border-2 border-blue-400 shadow-sm'
                    : 'bg-white border border-border hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Play className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground line-clamp-2 mb-1">
                      {video.title}
                    </p>
                    {video.educator && (
                      <p className="text-xs text-muted-foreground truncate">{video.educator}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        video.energyLevel === 'High' ? 'bg-red-100 text-red-700' :
                        video.energyLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {video.energyLevel}
                      </span>
                      <span className="text-xs text-muted-foreground">{video.duration}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-4 lg:p-6">
          {/* Mobile: Horizontal Video Carousel */}
          <div className="lg:hidden mb-6">
            <div
              ref={carouselRef}
              className="flex gap-3 overflow-x-auto py-3 px-1 snap-x snap-mandatory scrollbar-hide -mx-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filteredVideos.map((video, index) => (
                <button
                  key={video.id}
                  onClick={() => setCurrentVideoIndex(index)}
                  className={`flex-shrink-0 w-40 snap-center ${
                    currentVideoIndex === index ? 'ring-2 ring-blue-500' : ''
                  } rounded-xl overflow-hidden transition-all`}
                >
                  <div className={`bg-blue-100 aspect-video flex items-center justify-center ${
                    currentVideoIndex === index ? 'bg-blue-200' : ''
                  }`}>
                    <Play className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className={`p-2 text-left ${
                    currentVideoIndex === index ? 'bg-blue-50' : 'bg-white'
                  } border-t border-border`}>
                    <p className="text-xs font-medium text-foreground line-clamp-2">
                      {video.title}
                    </p>
                    <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-1 ${
                      video.energyLevel === 'High' ? 'bg-red-100 text-red-700' :
                      video.energyLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {video.energyLevel}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Current Video Info */}
          <div className="mb-4">
            <h4 className="text-lg lg:text-xl font-semibold text-foreground mb-2">
              {currentVideo.title}
            </h4>
            <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
              {currentVideo.educator && (
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {currentVideo.educator}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {currentVideo.duration}
              </span>
              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                currentVideo.energyLevel === 'High' ? 'bg-red-100 text-red-700' :
                currentVideo.energyLevel === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {currentVideo.energyLevel} Energy
              </span>
              <span className="text-xs text-muted-foreground">
                {currentVideo.ageGroup.join(', ')}
              </span>
            </div>
          </div>

          {/* Video Player */}
          <div className={`${
            currentVideo.isShort ? 'aspect-[9/16] max-w-[360px] mx-auto' : 'aspect-video'
          } bg-muted rounded-2xl overflow-hidden shadow-lg mb-6`}>
            <iframe
              width="100%"
              height="100%"
              src={getEmbedUrl(currentVideo.videoUrl)}
              title={currentVideo.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>

          {/* Guidance Panel */}
          <div className="space-y-5">
            {/* How to Conduct the Activity */}
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 lg:p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                  📋
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-semibold text-foreground mb-1">How to Conduct the Activity</h5>
                  <p className="text-xs text-muted-foreground">Step-by-step implementation guide</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-3">Steps:</p>
                  <ol className="space-y-2.5">
                    {currentVideo.guidance.howToConduct.steps.map((step, index) => (
                      <li key={index} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span className="w-5 h-5 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <span className="flex-1 leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-blue-200">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="text-sm font-medium text-foreground">{currentVideo.guidance.howToConduct.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Group Size</p>
                      <p className="text-sm font-medium text-foreground">{currentVideo.guidance.howToConduct.groupSize}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Materials</p>
                      <p className="text-sm font-medium text-foreground break-words">
                        {currentVideo.guidance.howToConduct.materialsNeeded.length > 0
                          ? currentVideo.guidance.howToConduct.materialsNeeded.join(', ')
                          : 'None'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* What to Model */}
            <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 lg:p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 bg-purple-600 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                  👀
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-semibold text-foreground mb-1">What to Model</h5>
                  <p className="text-xs text-muted-foreground">Demonstration techniques for educators</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-purple-700 mb-3">Key Movements to Exaggerate:</p>
                  <ul className="space-y-2">
                    {currentVideo.guidance.whatToModel.movements.map((movement, index) => (
                      <li key={index} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span className="text-purple-500 flex-shrink-0 mt-1">•</span>
                        <span className="flex-1 leading-relaxed">{movement}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-purple-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-purple-700 mb-2">Voice Tone:</p>
                      <p className="text-sm text-foreground leading-relaxed">{currentVideo.guidance.whatToModel.voiceTone}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-purple-700 mb-2">Facial Expressions:</p>
                      <p className="text-sm text-foreground leading-relaxed">{currentVideo.guidance.whatToModel.facialExpressions}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Development Focus */}
            <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 lg:p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 bg-green-600 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                  🎯
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-semibold text-foreground mb-1">Development Focus</h5>
                  <p className="text-xs text-muted-foreground">Learning outcomes and developmental areas</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {currentVideo.guidance.developmentFocus.map((focus, index) => (
                  <span
                    key={index}
                    className="px-3 py-1.5 bg-green-100 text-green-800 text-sm font-medium rounded-lg break-words"
                  >
                    {focus}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Next Video Button */}
          <div className="mt-6">
            <button
              onClick={handleNextVideo}
              className="w-full lg:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              style={{ minHeight: '44px' }}
            >
              <span>Next Example</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
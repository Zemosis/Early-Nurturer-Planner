import { useState } from "react";
import { SkipForward, SkipBack, Shuffle, ChevronDown, ChevronUp } from "lucide-react";

export interface YogaPose {
  id: string;
  name: string;
  imageUrl?: string;
  howTo?: string[];
  creativeCues?: string[];
}

interface YogaSectionProps {
  poses: YogaPose[];
}

export function YogaSection({ poses }: YogaSectionProps) {
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showCues, setShowCues] = useState(false);

  const currentPose = poses[currentPoseIndex];

  const handleNextPose = () => {
    setCurrentPoseIndex((currentPoseIndex + 1) % poses.length);
    setShowHowTo(false);
    setShowCues(false);
  };

  const handlePreviousPose = () => {
    setCurrentPoseIndex(currentPoseIndex === 0 ? poses.length - 1 : currentPoseIndex - 1);
    setShowHowTo(false);
    setShowCues(false);
  };

  const handleRandomPose = () => {
    setCurrentPoseIndex(Math.floor(Math.random() * poses.length));
    setShowHowTo(false);
    setShowCues(false);
  };

  if (!currentPose) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
        <p className="text-center text-muted-foreground">No yoga poses available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-100/80 to-pink-100/80 p-4 lg:p-6 border-b border-purple-200/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500 text-white rounded-xl flex items-center justify-center text-lg">
              🧘
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base lg:text-lg">Yoga Time</h3>
              <p className="text-xs text-muted-foreground">Mindful Movement & Breathing</p>
            </div>
          </div>
          <button
            onClick={handleRandomPose}
            className="p-2 bg-white/50 hover:bg-white rounded-lg transition-colors"
            aria-label="Random pose"
          >
            <Shuffle className="w-4 h-4 text-purple-700" />
          </button>
        </div>
      </div>

      {/* Current Pose Display */}
      <div className="p-4 lg:p-6">
        <div className="mb-4">
          <h4 className="text-xl lg:text-2xl font-semibold text-center text-foreground mb-1">
            {currentPose.name}
          </h4>
          <p className="text-sm text-center text-muted-foreground">
            Pose {currentPoseIndex + 1} of {poses.length}
          </p>
        </div>

        {/* Pose Image */}
        <div className="mb-5">
          {currentPose.imageUrl ? (
            <div className="rounded-2xl overflow-hidden shadow-lg bg-muted">
              <img
                src={currentPose.imageUrl}
                alt={currentPose.name}
                className="w-full h-auto object-contain max-h-[500px]"
              />
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl flex items-center justify-center">
              <div className="text-center p-6">
                <span className="text-6xl mb-3 block">🧘‍♀️</span>
                <p className="text-lg font-medium text-foreground">{currentPose.name}</p>
              </div>
            </div>
          )}
        </div>

        {/* How To — Foldable */}
        {currentPose.howTo && currentPose.howTo.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setShowHowTo(!showHowTo)}
              className="w-full flex items-center justify-between p-3 bg-purple-50/70 hover:bg-purple-50 rounded-xl border border-purple-100 transition-colors"
            >
              <span className="text-sm font-medium text-purple-700">How To</span>
              {showHowTo ? (
                <ChevronUp className="w-4 h-4 text-purple-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-purple-500" />
              )}
            </button>
            {showHowTo && (
              <div className="mt-2 p-4 bg-purple-50/30 rounded-xl border border-purple-100/50">
                <ol className="space-y-2">
                  {currentPose.howTo.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-foreground leading-relaxed">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-semibold">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Creative Cues — Foldable */}
        {currentPose.creativeCues && currentPose.creativeCues.length > 0 && (
          <div className="mb-5">
            <button
              onClick={() => setShowCues(!showCues)}
              className="w-full flex items-center justify-between p-3 bg-pink-50/70 hover:bg-pink-50 rounded-xl border border-pink-100 transition-colors"
            >
              <span className="text-sm font-medium text-pink-700">Creative Cues</span>
              {showCues ? (
                <ChevronUp className="w-4 h-4 text-pink-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-pink-500" />
              )}
            </button>
            {showCues && (
              <div className="mt-2 p-4 bg-pink-50/30 rounded-xl border border-pink-100/50">
                <ul className="space-y-2">
                  {currentPose.creativeCues.map((cue, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
                      <span className="flex-shrink-0 text-pink-500">✨</span>
                      <span>{cue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handlePreviousPose}
            className="p-3 lg:p-4 bg-muted/40 hover:bg-muted/60 rounded-xl transition-colors"
            style={{ minWidth: '44px', minHeight: '44px' }}
            aria-label="Previous pose"
          >
            <SkipBack className="w-5 h-5 text-foreground" />
          </button>

          <button
            onClick={handleNextPose}
            className="p-3 lg:p-4 bg-muted/40 hover:bg-muted/60 rounded-xl transition-colors"
            style={{ minWidth: '44px', minHeight: '44px' }}
            aria-label="Next pose"
          >
            <SkipForward className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

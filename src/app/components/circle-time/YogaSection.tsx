import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipForward, SkipBack, RotateCcw, Timer as TimerIcon, Shuffle } from "lucide-react";

export interface YogaPose {
  id: string;
  name: string;
  imageUrl?: string;
  videoUrl?: string;
  benefits: string;
  duration: number; // in seconds
}

interface YogaSectionProps {
  poses: YogaPose[];
}

export function YogaSection({ poses }: YogaSectionProps) {
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(poses[0]?.duration || 15);
  const [customDuration, setCustomDuration] = useState(15);
  const [isCalmMode, setIsCalmMode] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentPose = poses[currentPoseIndex];

  // Initialize audio for timer end
  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZURE="); // Gentle beep
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!isPaused && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Timer ended
            if (audioRef.current) {
              audioRef.current.play().catch(() => {});
            }
            if (isAutoMode) {
              handleNextPose();
            } else {
              setIsPaused(true);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPaused, timeRemaining, isAutoMode]);

  const handlePlayPause = () => {
    if (timeRemaining === 0) {
      setTimeRemaining(customDuration);
    }
    setIsPaused(!isPaused);
  };

  const handleNextPose = () => {
    const nextIndex = (currentPoseIndex + 1) % poses.length;
    setCurrentPoseIndex(nextIndex);
    setTimeRemaining(poses[nextIndex]?.duration || customDuration);
    setIsPaused(true);
  };

  const handlePreviousPose = () => {
    const prevIndex = currentPoseIndex === 0 ? poses.length - 1 : currentPoseIndex - 1;
    setCurrentPoseIndex(prevIndex);
    setTimeRemaining(poses[prevIndex]?.duration || customDuration);
    setIsPaused(true);
  };

  const handleResetTimer = () => {
    setTimeRemaining(customDuration);
    setIsPaused(true);
  };

  const handleRandomPose = () => {
    const randomIndex = Math.floor(Math.random() * poses.length);
    setCurrentPoseIndex(randomIndex);
    setTimeRemaining(poses[randomIndex]?.duration || customDuration);
    setIsPaused(true);
  };

  const handleDurationChange = (newDuration: number) => {
    setCustomDuration(newDuration);
    setTimeRemaining(newDuration);
    poses[currentPoseIndex].duration = newDuration;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentPose) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
        <p className="text-center text-muted-foreground">No yoga poses available</p>
      </div>
    );
  }

  return (
    <div 
      className={`bg-white rounded-2xl shadow-sm border border-border overflow-hidden transition-all duration-500 ${
        isCalmMode ? 'bg-gradient-to-br from-blue-50/50 to-purple-50/50' : ''
      }`}
    >
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCalmMode(!isCalmMode)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                isCalmMode
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/50 text-purple-700 hover:bg-white'
              }`}
            >
              {isCalmMode ? '✨ Calm' : '🌟 Normal'}
            </button>
            <button
              onClick={handleRandomPose}
              className="p-2 bg-white/50 hover:bg-white rounded-lg transition-colors"
              aria-label="Random pose"
            >
              <Shuffle className="w-4 h-4 text-purple-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Current Pose Display */}
      <div className="p-4 lg:p-6">
        <div className="mb-4">
          <h4 className="text-xl lg:text-2xl font-semibold text-center text-foreground mb-2">
            {currentPose.name}
          </h4>
          <p className="text-sm text-center text-muted-foreground">
            Pose {currentPoseIndex + 1} of {poses.length}
          </p>
        </div>

        {/* Pose Visual */}
        <div className="mb-6">
          {currentPose.videoUrl ? (
            <div className="aspect-video bg-muted rounded-2xl overflow-hidden shadow-lg">
              <iframe
                width="100%"
                height="100%"
                src={currentPose.videoUrl}
                title={currentPose.name}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ) : currentPose.imageUrl ? (
            <div className="rounded-2xl overflow-hidden shadow-lg bg-muted">
              <img
                src={currentPose.imageUrl}
                alt={currentPose.name}
                className="w-full h-auto object-cover"
                style={{ maxHeight: '400px' }}
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

        {/* Timer Display */}
        <div className="mb-6">
          <div className={`text-center p-6 lg:p-8 rounded-2xl transition-all duration-300 ${
            timeRemaining <= 5 && !isPaused
              ? 'bg-gradient-to-br from-orange-100 to-red-100 border-2 border-orange-300'
              : 'bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200'
          }`}>
            <div className="flex items-center justify-center gap-2 mb-3">
              <TimerIcon className={`w-5 h-5 ${timeRemaining <= 5 && !isPaused ? 'text-orange-600' : 'text-purple-600'}`} />
              <span className="text-sm font-medium text-muted-foreground">Time Remaining</span>
            </div>
            <div className={`text-5xl lg:text-6xl font-bold transition-colors ${
              timeRemaining <= 5 && !isPaused ? 'text-orange-600' : 'text-purple-600'
            }`}>
              {formatTime(timeRemaining)}
            </div>
          </div>

          {/* Duration Adjustment */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <label className="text-sm text-muted-foreground">Duration:</label>
            <div className="flex items-center gap-2">
              {[10, 15, 20, 30].map((duration) => (
                <button
                  key={duration}
                  onClick={() => handleDurationChange(duration)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                    customDuration === duration
                      ? 'bg-purple-500 text-white shadow-sm'
                      : 'bg-muted/50 text-foreground hover:bg-muted'
                  }`}
                >
                  {duration}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pose Benefits */}
        <div className="mb-6 p-4 bg-purple-50/50 rounded-xl border border-purple-100">
          <p className="text-xs font-medium text-purple-700 mb-2">Benefits:</p>
          <p className="text-sm text-foreground leading-relaxed">{currentPose.benefits}</p>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex items-center justify-center gap-3 p-3 bg-muted/30 rounded-xl">
            <span className="text-sm text-muted-foreground">Mode:</span>
            <button
              onClick={() => setIsAutoMode(false)}
              className={`px-4 py-2 text-sm rounded-lg transition-all ${
                !isAutoMode
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'bg-white text-foreground hover:bg-gray-50'
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => setIsAutoMode(true)}
              className={`px-4 py-2 text-sm rounded-lg transition-all ${
                isAutoMode
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'bg-white text-foreground hover:bg-gray-50'
              }`}
            >
              Auto
            </button>
          </div>

          {/* Playback Controls */}
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
              onClick={handleResetTimer}
              className="p-3 lg:p-4 bg-muted/40 hover:bg-muted/60 rounded-xl transition-colors"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label="Reset timer"
            >
              <RotateCcw className="w-5 h-5 text-foreground" />
            </button>

            <button
              onClick={handlePlayPause}
              className="p-4 lg:p-5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-all shadow-lg hover:shadow-xl"
              style={{ minWidth: '56px', minHeight: '56px' }}
              aria-label={isPaused ? 'Start timer' : 'Pause timer'}
            >
              {isPaused ? (
                <Play className="w-6 h-6 ml-0.5" />
              ) : (
                <Pause className="w-6 h-6" />
              )}
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

          {isAutoMode && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground bg-purple-50/50 rounded-lg py-2 px-4 inline-block">
                🔄 Auto mode: Will transition to next pose when timer ends
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

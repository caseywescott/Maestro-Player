import React, { useCallback, useMemo } from "react"
import type { ExtendedCue } from "../useEnhancediMuse"

interface SmartTransitionsProps {
  currentCue: ExtendedCue | null
  availableCues: ExtendedCue[]
  smartTransition: (
    cue: ExtendedCue,
    context: "user_input" | "automatic" | "random"
  ) => void
  transitionStatus: string | null
  isPlaying: boolean
}

const getCueName = (cue: ExtendedCue | null): string => {
  if (!cue) return "No cue"
  return cue.id || "Unknown cue"
}

const CueCard = React.memo(
  ({
    cue,
    onSelect,
    isCurrentCue,
  }: {
    cue: ExtendedCue
    onSelect: () => void
    isCurrentCue: boolean
  }) => {
    const cueName = useMemo(() => getCueName(cue), [cue])

    return (
      <div className={`cue-card ${isCurrentCue ? "current" : ""}`}>
        <h4>{cueName}</h4>
        {cue.metadata && (
          <div className="cue-metadata">
            <small>
              Tempo: {cue.tempo?.toFixed(1) || "Unknown"} BPM
              {cue.key !== undefined && ` | Key: ${cue.key}`}
              {cue.metadata.entryPoints && (
                <> | Entry Points: {cue.metadata.entryPoints.length}</>
              )}
            </small>
          </div>
        )}
        {!isCurrentCue && (
          <button onClick={onSelect} className="transition-button">
            Transition to this cue
          </button>
        )}
      </div>
    )
  }
)

const SmartTransitions: React.FC<SmartTransitionsProps> = React.memo(
  ({
    currentCue,
    availableCues,
    smartTransition,
    transitionStatus,
    isPlaying,
  }) => {
    const currentCueName = useMemo(() => getCueName(currentCue), [currentCue])

    const selectableCues = useMemo(() => {
      if (!currentCue) return availableCues
      return availableCues.filter((cue) => cue.id !== currentCue.id)
    }, [availableCues, currentCue])

    const createTransitionHandler = useCallback(
      (cue: ExtendedCue) => {
        return () => {
          console.log("🎼 Smart transition triggered for cue:", cue.id)
          smartTransition(cue, "user_input")
        }
      },
      [smartTransition]
    )

    const smartAnalysis = useMemo(() => {
      if (!currentCue || !isPlaying) {
        return {
          compatibleCues: [],
          recommendations: [],
          hasAnalysis: false,
        }
      }

      const compatibleCues = selectableCues.filter((cue) => {
        if (currentCue.tempo && cue.tempo) {
          const tempoRatio =
            Math.abs(cue.tempo - currentCue.tempo) / currentCue.tempo
          if (tempoRatio > 0.2) return false
        }

        if (currentCue.key !== undefined && cue.key !== undefined) {
          const keyDifference = Math.abs(cue.key - currentCue.key)
          if (keyDifference > 6) return false
        }

        return true
      })

      const recommendations = compatibleCues.slice(0, 3)

      return {
        compatibleCues,
        recommendations,
        hasAnalysis: true,
      }
    }, [currentCue, selectableCues, isPlaying])

    return (
      <div className="smart-transitions">
        <h4>🧠 Smart Transitions</h4>

        <div className="current-status">
          <div className="status-item">
            <strong>Current Cue:</strong> {currentCueName}
          </div>
          <div className="status-item">
            <strong>Playing:</strong> {isPlaying ? "Yes" : "No"}
          </div>
          {transitionStatus && (
            <div className="transition-status">
              <strong>Status:</strong> {transitionStatus}
            </div>
          )}
        </div>

        {smartAnalysis.hasAnalysis && (
          <div className="smart-analysis">
            <h5>🎵 Smart Analysis</h5>
            <div className="analysis-stats">
              <div className="stat-item">
                <strong>Compatible Cues:</strong>{" "}
                {smartAnalysis.compatibleCues.length}
              </div>
              <div className="stat-item">
                <strong>Available Cues:</strong> {selectableCues.length}
              </div>
            </div>

            {smartAnalysis.recommendations.length > 0 && (
              <div className="recommendations">
                <h6>🌟 Recommended Transitions</h6>
                <div className="recommendation-grid">
                  {smartAnalysis.recommendations.map((cue) => (
                    <CueCard
                      key={cue.id}
                      cue={cue}
                      onSelect={createTransitionHandler(cue)}
                      isCurrentCue={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="all-cues">
          <h5>🎼 All Available Cues</h5>
          {selectableCues.length > 0 ? (
            <div className="cue-grid">
              {selectableCues.map((cue) => (
                <CueCard
                  key={cue.id}
                  cue={cue}
                  onSelect={createTransitionHandler(cue)}
                  isCurrentCue={false}
                />
              ))}
            </div>
          ) : (
            <p>No other cues available for transition.</p>
          )}
        </div>

        {currentCue && (
          <div className="current-cue-info">
            <h5>📋 Current Cue Details</h5>
            <CueCard cue={currentCue} onSelect={() => {}} isCurrentCue={true} />
          </div>
        )}

        <div className="transition-controls">
          <h5>🎛️ Transition Controls</h5>
          <div className="control-info">
            <p>
              <strong>How it works:</strong> Smart transitions analyze tempo,
              key, and musical structure to find the best moments for seamless
              cue changes.
            </p>
            <ul>
              <li>
                <strong>Compatible cues</strong> match tempo and key signatures
              </li>
              <li>
                <strong>Recommended cues</strong> are the most musically
                coherent options
              </li>
              <li>
                <strong>Transitions</strong> happen at optimal musical
                boundaries
              </li>
            </ul>
          </div>
        </div>

        <style>{`
        .smart-transitions {
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #fafafa;
        }

        .current-status {
          margin-bottom: 20px;
          padding: 10px;
          background: #e8f4fd;
          border-radius: 4px;
        }

        .status-item {
          margin: 5px 0;
          font-size: 14px;
        }

        .transition-status {
          margin: 5px 0;
          padding: 8px;
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 3px;
          font-style: italic;
        }

        .smart-analysis {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #28a745;
          border-radius: 6px;
          background: #f8fff9;
        }

        .analysis-stats {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
        }

        .stat-item {
          padding: 8px 12px;
          background: #e7f3e7;
          border-radius: 4px;
          font-size: 13px;
        }

        .recommendations {
          margin-top: 15px;
        }

        .recommendation-grid,
        .cue-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 15px;
          margin-top: 10px;
        }

        .cue-card {
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: white;
          transition: all 0.2s ease;
        }

        .cue-card:hover {
          border-color: #007acc;
          box-shadow: 0 2px 8px rgba(0, 122, 204, 0.1);
        }

        .cue-card.current {
          border-color: #28a745;
          background: #f8fff9;
        }

        .cue-card h4 {
          margin: 0 0 8px 0;
          color: #333;
          font-size: 16px;
        }

        .cue-metadata {
          margin: 8px 0;
          color: #666;
        }

        .transition-button {
          margin-top: 10px;
          padding: 8px 12px;
          border: 1px solid #007acc;
          border-radius: 4px;
          background: #007acc;
          color: white;
          cursor: pointer;
          font-size: 13px;
          width: 100%;
          transition: background 0.2s;
        }

        .transition-button:hover {
          background: #005c99;
        }

        .all-cues,
        .current-cue-info {
          margin: 20px 0;
        }

        .transition-controls {
          margin-top: 25px;
          padding: 15px;
          background: #f0f8ff;
          border-radius: 6px;
        }

        .control-info {
          font-size: 14px;
          line-height: 1.5;
        }

        .control-info ul {
          margin: 10px 0;
          padding-left: 20px;
        }

        .control-info li {
          margin: 5px 0;
        }

        h5, h6 {
          margin: 0 0 10px 0;
          color: #333;
        }

        h6 {
          font-size: 14px;
          color: #666;
        }
      `}</style>
      </div>
    )
  }
)

export default SmartTransitions

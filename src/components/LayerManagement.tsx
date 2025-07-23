import React, { useEffect, useState } from "react"

interface LayerManagementProps {
  fadeInLayer: (channel: number, duration?: number) => void
  fadeOutLayer: (channel: number, duration?: number) => void
  adjustLayersBasedOnUserActions: (
    action: "tempo_change" | "transpose_change" | "reverb_change"
  ) => void
  isPlaying: boolean
  currentInstruments: { [channel: number]: number }
}

interface LayerState {
  channel: number
  isActive: boolean
  volume: number
  instrumentId: number
  lastActivity: number
}

export const LayerManagement: React.FC<LayerManagementProps> = ({
  fadeInLayer,
  fadeOutLayer,
  adjustLayersBasedOnUserActions,
  isPlaying,
  currentInstruments,
}) => {
  const [layers, setLayers] = useState<LayerState[]>([])
  const [fadeDuration, setFadeDuration] = useState<number>(1000)
  const [autoAdaptive, setAutoAdaptive] = useState<boolean>(true)
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false)

  // Initialize layers based on current instruments
  useEffect(() => {
    const newLayers: LayerState[] = []

    // Add layers for channels with instruments
    Object.entries(currentInstruments).forEach(([channelStr, instrumentId]) => {
      const channel = parseInt(channelStr)
      newLayers.push({
        channel,
        isActive: true,
        volume: 1.0,
        instrumentId,
        lastActivity: Date.now(),
      })
    })

    // Add some potential layers for empty channels
    for (let i = 0; i < 16; i++) {
      if (!currentInstruments[i]) {
        newLayers.push({
          channel: i,
          isActive: false,
          volume: 0.0,
          instrumentId: 0,
          lastActivity: 0,
        })
      }
    }

    setLayers(newLayers.sort((a, b) => a.channel - b.channel))
  }, [currentInstruments])

  const handleFadeIn = (channel: number) => {
    fadeInLayer(channel, fadeDuration)
    setLayers((prev) =>
      prev.map((layer) =>
        layer.channel === channel
          ? { ...layer, isActive: true, volume: 1.0, lastActivity: Date.now() }
          : layer
      )
    )
  }

  const handleFadeOut = (channel: number) => {
    fadeOutLayer(channel, fadeDuration)
    setLayers((prev) =>
      prev.map((layer) =>
        layer.channel === channel
          ? { ...layer, isActive: false, volume: 0.0, lastActivity: Date.now() }
          : layer
      )
    )
  }

  const handleQuickFadeAll = (action: "fade_in" | "fade_out") => {
    layers.forEach((layer) => {
      if (action === "fade_in" && !layer.isActive) {
        handleFadeIn(layer.channel)
      } else if (action === "fade_out" && layer.isActive) {
        handleFadeOut(layer.channel)
      }
    })
  }

  const handleAdaptiveAction = (
    action: "tempo_change" | "transpose_change" | "reverb_change"
  ) => {
    adjustLayersBasedOnUserActions(action)
    // Update visual feedback
    setLayers((prev) =>
      prev.map((layer) => ({
        ...layer,
        lastActivity: Date.now(),
      }))
    )
  }

  const getInstrumentName = (instrumentId: number): string => {
    // Simple GM instrument names
    const gmInstruments: { [key: number]: string } = {
      0: "Piano",
      1: "Bright Piano",
      2: "Electric Piano",
      3: "Honky-tonk",
      24: "Nylon Guitar",
      25: "Steel Guitar",
      26: "Jazz Guitar",
      27: "Clean Guitar",
      40: "Violin",
      41: "Viola",
      42: "Cello",
      43: "Contrabass",
      56: "Trumpet",
      57: "Trombone",
      58: "Tuba",
      59: "Muted Trumpet",
      73: "Flute",
      74: "Recorder",
      75: "Pan Flute",
      76: "Blown Bottle",
      128: "Drums",
    }
    return gmInstruments[instrumentId] || `Instrument ${instrumentId}`
  }

  const getLayerTypeIcon = (channel: number): string => {
    if (channel === 9) return "🥁" // Drums
    if (channel >= 0 && channel <= 7) return "🎹" // Lead instruments
    if (channel >= 8 && channel <= 15) return "🎵" // Harmony/Bass
    return "🎶"
  }

  const activeLayers = layers.filter((l) => l.isActive)
  const inactiveLayers = layers.filter((l) => !l.isActive)

  return (
    <div
      style={{
        padding: "15px",
        border: "1px solid #28a745",
        borderRadius: "8px",
        background: "linear-gradient(135deg, #f8fff8 0%, #e8ffe8 100%)",
        marginBottom: "20px",
      }}
    >
      <h4
        style={{
          margin: "0 0 15px 0",
          color: "#155724",
          fontSize: "1.2em",
        }}
      >
        🎛️ Layer Management
      </h4>

      {!isPlaying && (
        <div
          style={{
            background: "#fef5e7",
            border: "1px solid #f0ad4e",
            borderRadius: "4px",
            padding: "8px 12px",
            marginBottom: "15px",
            fontSize: "0.9em",
            color: "#8a6d3b",
          }}
        >
          ⚠️ Start playback to enable layer controls
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Active Layers */}
        <div
          style={{
            background: "white",
            padding: "15px",
            borderRadius: "6px",
            border: "1px solid #d4edda",
          }}
        >
          <h5
            style={{
              margin: "0 0 12px 0",
              color: "#155724",
              fontSize: "1em",
            }}
          >
            Active Layers ({activeLayers.length})
          </h5>

          {activeLayers.length === 0 ? (
            <div
              style={{
                color: "#6c757d",
                fontStyle: "italic",
                padding: "10px",
                textAlign: "center",
              }}
            >
              No active layers
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: "10px",
              }}
            >
              {activeLayers.map((layer) => (
                <div
                  key={layer.channel}
                  style={{
                    background: "#f8fff8",
                    border: "1px solid #28a745",
                    borderRadius: "4px",
                    padding: "10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span style={{ fontSize: "1.2em" }}>
                      {getLayerTypeIcon(layer.channel)}
                    </span>
                    <div>
                      <div
                        style={{
                          fontWeight: "600",
                          fontSize: "0.9em",
                          color: "#155724",
                        }}
                      >
                        Channel {layer.channel}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8em",
                          color: "#6c757d",
                        }}
                      >
                        {getInstrumentName(layer.instrumentId)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleFadeOut(layer.channel)}
                    disabled={!isPlaying}
                    style={{
                      padding: "6px 10px",
                      border: "none",
                      borderRadius: "3px",
                      background: "#dc3545",
                      color: "white",
                      cursor: isPlaying ? "pointer" : "not-allowed",
                      fontSize: "0.8em",
                      opacity: !isPlaying ? 0.5 : 1,
                      transition: "all 0.2s ease",
                    }}
                  >
                    Fade Out
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div
          style={{
            background: "white",
            padding: "15px",
            borderRadius: "6px",
            border: "1px solid #e0e6ed",
          }}
        >
          <h5
            style={{
              margin: "0 0 12px 0",
              color: "#333",
              fontSize: "1em",
            }}
          >
            Layer Controls
          </h5>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "15px",
              marginBottom: "15px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontWeight: "600",
                  fontSize: "0.9em",
                  color: "#555",
                }}
              >
                Fade Duration: {fadeDuration}ms
              </label>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={fadeDuration}
                onChange={(e) => setFadeDuration(parseInt(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "0.9em",
                  color: "#555",
                }}
              >
                <input
                  type="checkbox"
                  checked={autoAdaptive}
                  onChange={(e) => setAutoAdaptive(e.target.checked)}
                />
                Auto-Adaptive Layers
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "15px",
            }}
          >
            <button
              onClick={() => handleQuickFadeAll("fade_in")}
              disabled={!isPlaying || activeLayers.length === layers.length}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                background: "#28a745",
                color: "white",
                cursor:
                  isPlaying && activeLayers.length < layers.length
                    ? "pointer"
                    : "not-allowed",
                fontSize: "0.9em",
                opacity:
                  !isPlaying || activeLayers.length === layers.length ? 0.5 : 1,
              }}
            >
              ⬆️ Fade In All
            </button>
            <button
              onClick={() => handleQuickFadeAll("fade_out")}
              disabled={!isPlaying || activeLayers.length === 0}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                background: "#dc3545",
                color: "white",
                cursor:
                  isPlaying && activeLayers.length > 0
                    ? "pointer"
                    : "not-allowed",
                fontSize: "0.9em",
                opacity: !isPlaying || activeLayers.length === 0 ? 0.5 : 1,
              }}
            >
              ⬇️ Fade Out All
            </button>
          </div>

          {autoAdaptive && (
            <div
              style={{
                background: "#f8f9fa",
                padding: "12px",
                borderRadius: "4px",
                border: "1px solid #e9ecef",
              }}
            >
              <h6
                style={{
                  margin: "0 0 8px 0",
                  color: "#495057",
                  fontSize: "0.9em",
                }}
              >
                Adaptive Actions
              </h6>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => handleAdaptiveAction("tempo_change")}
                  disabled={!isPlaying}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid #007bff",
                    borderRadius: "3px",
                    background: "transparent",
                    color: "#007bff",
                    cursor: isPlaying ? "pointer" : "not-allowed",
                    fontSize: "0.8em",
                    opacity: !isPlaying ? 0.5 : 1,
                  }}
                >
                  🎵 Tempo Adapt
                </button>
                <button
                  onClick={() => handleAdaptiveAction("transpose_change")}
                  disabled={!isPlaying}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid #007bff",
                    borderRadius: "3px",
                    background: "transparent",
                    color: "#007bff",
                    cursor: isPlaying ? "pointer" : "not-allowed",
                    fontSize: "0.8em",
                    opacity: !isPlaying ? 0.5 : 1,
                  }}
                >
                  🎹 Key Adapt
                </button>
                <button
                  onClick={() => handleAdaptiveAction("reverb_change")}
                  disabled={!isPlaying}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid #007bff",
                    borderRadius: "3px",
                    background: "transparent",
                    color: "#007bff",
                    cursor: isPlaying ? "pointer" : "not-allowed",
                    fontSize: "0.8em",
                    opacity: !isPlaying ? 0.5 : 1,
                  }}
                >
                  🌊 Reverb Adapt
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: "#f8f9fa",
              border: "1px solid #dee2e6",
              padding: "8px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.85em",
              color: "#6c757d",
            }}
          >
            {showAdvanced ? "▲" : "▼"} Advanced Analytics
          </button>

          {showAdvanced && (
            <div
              style={{
                marginTop: "12px",
                padding: "15px",
                background: "#f8f9fa",
                borderRadius: "4px",
                border: "1px solid #e9ecef",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "10px",
                  fontSize: "0.85em",
                }}
              >
                <div
                  style={{
                    background: "white",
                    padding: "8px",
                    borderRadius: "3px",
                    border: "1px solid #dee2e6",
                  }}
                >
                  <strong>Total Layers:</strong> {layers.length}
                </div>
                <div
                  style={{
                    background: "white",
                    padding: "8px",
                    borderRadius: "3px",
                    border: "1px solid #dee2e6",
                  }}
                >
                  <strong>Active:</strong> {activeLayers.length}
                </div>
                <div
                  style={{
                    background: "white",
                    padding: "8px",
                    borderRadius: "3px",
                    border: "1px solid #dee2e6",
                  }}
                >
                  <strong>Utilization:</strong>{" "}
                  {layers.length > 0
                    ? Math.round((activeLayers.length / layers.length) * 100)
                    : 0}
                  %
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Add default export
export default LayerManagement

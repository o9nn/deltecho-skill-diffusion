/**
 * Glyph Decoder
 * 
 * Decodes visual glyphs back to execution trajectories
 * Implements inverse mapping: γ → τ
 */

import {
  GlyphFormat,
  type Glyph,
  type Trajectory,
  type Action,
  type State,
  type Observation,
  type Stroke,
  type TimeChannel,
  type VectorField,
  type ContactMap,
  type Point2D,
} from '../glyph/types.js';

export interface GlyphDecoderConfig {
  /** Temporal resolution for reconstruction */
  temporalResolution?: number;

  /** Spatial resolution for reconstruction */
  spatialResolution?: number;

  /** Confidence threshold for state estimation */
  confidenceThreshold?: number;

  /** Enable probabilistic decoding */
  probabilistic?: boolean;

  /** Noise tolerance level */
  noiseTolerance?: number;
}

/**
 * Decoder for stroke-based glyphs
 */
class StrokeDecoder {
  constructor(private config: GlyphDecoderConfig) {}

  decode(stroke: Stroke, trajectoryId: string, goal: string): Trajectory {
    const actions: Action[] = [];
    const states: State[] = [];
    const observations: Observation[] = [];

    // Reconstruct actions from stroke points
    for (let i = 0; i < stroke.points.length - 1; i++) {
      const point = stroke.points[i];
      const nextPoint = stroke.points[i + 1];
      const timestamp = stroke.timestamps[i];

      // Calculate velocity from thickness
      const velocity = this.velocityFromThickness(stroke.thickness[i]);

      // Calculate direction vector
      const direction: Point2D = {
        x: nextPoint.x - point.x,
        y: nextPoint.y - point.y,
      };

      // Normalize direction
      const magnitude = Math.sqrt(direction.x ** 2 + direction.y ** 2);
      if (magnitude > 0) {
        direction.x /= magnitude;
        direction.y /= magnitude;
      }

      actions.push({
        type: 'move',
        params: {
          from: point,
          to: nextPoint,
        },
        timestamp,
        location: point,
        velocity,
        direction,
      });

      // Reconstruct state from action
      states.push({
        data: {
          position: point,
          velocity,
          direction,
        },
        timestamp,
        confidence: this.calculateConfidence(stroke.thickness[i]),
      });

      // Create observation
      observations.push({
        data: {
          position: point,
          color: stroke.color[i],
        },
        timestamp,
        type: 'visual',
      });
    }

    return {
      id: trajectoryId,
      goal,
      context: {},
      actions,
      states,
      observations,
      startTime: stroke.timestamps[0],
      endTime: stroke.timestamps[stroke.timestamps.length - 1],
      success: true,
      metadata: {
        decodedFrom: 'stroke',
        pointCount: stroke.points.length,
      },
    };
  }

  private velocityFromThickness(thickness: number): number {
    // Inverse mapping: thicker strokes = faster movement
    return thickness * 10;
  }

  private calculateConfidence(thickness: number): number {
    // Thicker strokes = higher confidence
    return Math.min(1.0, thickness / 5);
  }
}

/**
 * Decoder for time-channel glyphs
 */
class TimeChannelDecoder {
  constructor(private config: GlyphDecoderConfig) {}

  decode(timeChannel: TimeChannel, trajectoryId: string, goal: string): Trajectory {
    const actions: Action[] = [];
    const states: State[] = [];
    const observations: Observation[] = [];

    // Scan through time bins
    for (let t = 0; t < timeChannel.timeBins; t++) {
      const timeData = timeChannel.data[t];

      // Find active regions in this time bin
      const activeRegions = this.findActiveRegions(timeData);

      for (const region of activeRegions) {
        const timestamp = (t / timeChannel.timeBins) * 1000; // Normalize to ms

        actions.push({
          type: 'activate',
          params: {
            region: region.center,
            intensity: region.intensity,
          },
          timestamp,
          location: region.center,
          velocity: region.velocity,
        });

        states.push({
          data: {
            activeRegion: region.center,
            intensity: region.intensity,
          },
          timestamp,
          confidence: region.confidence,
        });

        observations.push({
          data: {
            activation: region.intensity,
            location: region.center,
          },
          timestamp,
          type: 'activation',
        });
      }
    }

    return {
      id: trajectoryId,
      goal,
      context: {},
      actions,
      states,
      observations,
      startTime: 0,
      endTime: 1000,
      success: true,
      metadata: {
        decodedFrom: 'time_channel',
        timeBins: timeChannel.timeBins,
      },
    };
  }

  private findActiveRegions(
    timeData: number[][]
  ): Array<{
    center: Point2D;
    intensity: number;
    velocity: number;
    confidence: number;
  }> {
    const regions: Array<{
      center: Point2D;
      intensity: number;
      velocity: number;
      confidence: number;
    }> = [];

    // Simple peak detection
    for (let y = 1; y < timeData.length - 1; y++) {
      for (let x = 1; x < timeData[y].length - 1; x++) {
        const value = timeData[y][x];
        if (value > 0.5) {
          // Threshold
          regions.push({
            center: { x, y },
            intensity: value,
            velocity: this.estimateVelocity(timeData, x, y),
            confidence: value,
          });
        }
      }
    }

    return regions;
  }

  private estimateVelocity(data: number[][], x: number, y: number): number {
    // Estimate velocity from gradient
    const dx = data[y][x + 1] - data[y][x - 1];
    const dy = data[y + 1][x] - data[y - 1][x];
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/**
 * Decoder for vector field glyphs
 */
class VectorFieldDecoder {
  constructor(private config: GlyphDecoderConfig) {}

  decode(vectorField: VectorField, trajectoryId: string, goal: string): Trajectory {
    const actions: Action[] = [];
    const states: State[] = [];
    const observations: Observation[] = [];

    // Sort vectors by phase (time ordering)
    const sortedVectors = [...vectorField.vectors].sort((a, b) => a.phase - b.phase);

    for (const vector of sortedVectors) {
      const timestamp = vector.phase * 1000; // Convert phase to ms

      actions.push({
        type: 'flow',
        params: {
          position: vector.position,
          direction: vector.direction,
          magnitude: vector.magnitude,
        },
        timestamp,
        location: vector.position,
        velocity: vector.magnitude,
        direction: vector.direction,
      });

      states.push({
        data: {
          position: vector.position,
          flowDirection: vector.direction,
          flowMagnitude: vector.magnitude,
        },
        timestamp,
        confidence: Math.min(1.0, vector.magnitude),
      });

      observations.push({
        data: {
          vector: {
            position: vector.position,
            direction: vector.direction,
            magnitude: vector.magnitude,
          },
        },
        timestamp,
        type: 'vector',
      });
    }

    return {
      id: trajectoryId,
      goal,
      context: {},
      actions,
      states,
      observations,
      startTime: 0,
      endTime: 1000,
      success: true,
      metadata: {
        decodedFrom: 'vector_field',
        vectorCount: vectorField.vectors.length,
      },
    };
  }
}

/**
 * Decoder for contact map glyphs
 */
class ContactMapDecoder {
  constructor(private config: GlyphDecoderConfig) {}

  decode(contactMap: ContactMap, trajectoryId: string, goal: string): Trajectory {
    const actions: Action[] = [];
    const states: State[] = [];
    const observations: Observation[] = [];

    // Sort contacts by time
    const sortedContacts = [...contactMap.contacts].sort((a, b) => a.time - b.time);

    for (const contact of sortedContacts) {
      const timestamp = (contact.time / contactMap.timeSteps) * 1000;

      actions.push({
        type: 'contact',
        params: {
          location: contact.location,
          contactType: contact.type,
          strength: contact.strength,
        },
        timestamp,
        location: contact.location as Point2D,
        velocity: 0,
      });

      states.push({
        data: {
          contactActive: true,
          contactLocation: contact.location,
          contactStrength: contact.strength,
        },
        timestamp,
        confidence: contact.strength,
      });

      observations.push({
        data: {
          contact: {
            location: contact.location,
            type: contact.type,
            strength: contact.strength,
          },
        },
        timestamp,
        type: 'contact',
      });
    }

    return {
      id: trajectoryId,
      goal,
      context: {},
      actions,
      states,
      observations,
      startTime: 0,
      endTime: 1000,
      success: true,
      metadata: {
        decodedFrom: 'contact_map',
        contactCount: contactMap.contacts.length,
      },
    };
  }
}

/**
 * Main Glyph Decoder
 */
export class GlyphDecoder {
  private strokeDecoder: StrokeDecoder;
  private timeChannelDecoder: TimeChannelDecoder;
  private vectorFieldDecoder: VectorFieldDecoder;
  private contactMapDecoder: ContactMapDecoder;

  constructor(private config: GlyphDecoderConfig = {}) {
    this.strokeDecoder = new StrokeDecoder(config);
    this.timeChannelDecoder = new TimeChannelDecoder(config);
    this.vectorFieldDecoder = new VectorFieldDecoder(config);
    this.contactMapDecoder = new ContactMapDecoder(config);
  }

  /**
   * Decode glyph to trajectory
   */
  decode(glyph: Glyph): Trajectory {
    const goal = `Decoded from ${glyph.format}`;

    switch (glyph.format) {
      case GlyphFormat.STROKE:
        return this.strokeDecoder.decode(glyph.data as Stroke, glyph.trajectoryId, goal);

      case GlyphFormat.TIME_CHANNEL:
        return this.timeChannelDecoder.decode(
          glyph.data as TimeChannel,
          glyph.trajectoryId,
          goal
        );

      case GlyphFormat.VECTOR_FIELD:
        return this.vectorFieldDecoder.decode(
          glyph.data as VectorField,
          glyph.trajectoryId,
          goal
        );

      case GlyphFormat.CONTACT_MAP:
        return this.contactMapDecoder.decode(
          glyph.data as ContactMap,
          glyph.trajectoryId,
          goal
        );

      default:
        throw new Error(`Unsupported glyph format: ${glyph.format}`);
    }
  }

  /**
   * Probabilistic decoding with multiple hypotheses
   */
  decodeProbabilistic(glyph: Glyph, numHypotheses: number = 5): Trajectory[] {
    if (!this.config.probabilistic) {
      return [this.decode(glyph)];
    }

    const hypotheses: Trajectory[] = [];

    for (let i = 0; i < numHypotheses; i++) {
      // Add noise for variation
      const noisyGlyph = this.addNoise(glyph, this.config.noiseTolerance || 0.1);
      hypotheses.push(this.decode(noisyGlyph));
    }

    return hypotheses;
  }

  private addNoise(glyph: Glyph, noiseLevel: number): Glyph {
    // Deep copy and add noise
    const noisyGlyph = JSON.parse(JSON.stringify(glyph)) as Glyph;

    if (glyph.format === GlyphFormat.STROKE) {
      const stroke = noisyGlyph.data as Stroke;
      stroke.points = stroke.points.map((p) => ({
        x: p.x + (Math.random() - 0.5) * noiseLevel,
        y: p.y + (Math.random() - 0.5) * noiseLevel,
      }));
    }

    return noisyGlyph;
  }
}

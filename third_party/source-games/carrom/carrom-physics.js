// 2D Rigid Body Circular Physics Engine for Carrom Board Game

class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    copy(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    mult(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }

    div(n) {
        if (n !== 0) {
            this.x /= n;
            this.y /= n;
        }
        return this;
    }

    magSq() {
        return this.x * this.x + this.y * this.y;
    }

    mag() {
        return Math.sqrt(this.magSq());
    }

    normalize() {
        const m = this.mag();
        if (m !== 0) {
            this.div(m);
        }
        return this;
    }

    dist(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }
}

class Disc {
    constructor(x, y, radius, mass, type, color) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2(0, 0);
        this.radius = radius;
        this.mass = mass;
        this.invMass = mass > 0 ? 1 / mass : 0;
        this.type = type; // 'striker', 'white', 'black', 'queen'
        this.color = color;
        
        this.pocketed = false;
        this.isSinking = false;
        this.sinkScale = 1.0;
        this.sinkTarget = null;
        this.isQueen = type === 'queen';
        this.highlight = false;
    }

    update(friction, minVelocity) {
        if (this.pocketed) return;

        if (this.isSinking) {
            // Smoothly suck into the pocket center
            if (this.sinkTarget) {
                const dx = this.sinkTarget.x - this.pos.x;
                const dy = this.sinkTarget.y - this.pos.y;
                this.pos.x += dx * 0.25;
                this.pos.y += dy * 0.25;
            }
            this.sinkScale *= 0.85;
            this.vel.set(0, 0);

            if (this.sinkScale < 0.1) {
                this.pocketed = true;
                this.isSinking = false;
                this.sinkScale = 0;
            }
            return;
        }

        // Apply friction
        this.vel.mult(friction);

        // Stop if velocity is below cutoff
        if (this.vel.magSq() < minVelocity * minVelocity) {
            this.vel.set(0, 0);
        }

        // Update position
        this.pos.add(this.vel);
    }

    isMoving() {
        return !this.pocketed && (this.vel.magSq() > 0.0001 || this.isSinking);
    }
}

class CarromPhysicsEngine {
    constructor(boardConfig, audio) {
        this.config = boardConfig;
        this.audio = audio;
        
        this.friction = 0.987; // Realistic carrom powder friction
        this.minVelocity = 0.04;
        this.restitution = 0.94; // Elastic collisions
        this.wallRestitution = 0.88;
        this.subSteps = 8; // Anti-tunneling physics substeps

        this.discs = [];
        this.pockets = [];
        this.onPocketedCallback = null;
    }

    initPockets(pockets) {
        this.pockets = pockets;
    }

    setDiscs(discs) {
        this.discs = discs;
    }

    update() {
        const subFriction = Math.pow(this.friction, 1 / this.subSteps);
        
        for (let step = 0; step < this.subSteps; step++) {
            // Update individual disc physics
            for (let i = 0; i < this.discs.length; i++) {
                this.discs[i].update(subFriction, this.minVelocity);
            }

            // Disc-Disc Collisions
            for (let i = 0; i < this.discs.length; i++) {
                const d1 = this.discs[i];
                if (d1.pocketed || d1.isSinking) continue;

                for (let j = i + 1; j < this.discs.length; j++) {
                    const d2 = this.discs[j];
                    if (d2.pocketed || d2.isSinking) continue;

                    this.resolveDiscCollision(d1, d2);
                }
            }

            // Disc-Wall Collisions
            for (let i = 0; i < this.discs.length; i++) {
                const d = this.discs[i];
                if (d.pocketed || d.isSinking) continue;
                this.resolveWallCollision(d);
            }

            // Pocket Checks
            for (let i = 0; i < this.discs.length; i++) {
                const d = this.discs[i];
                if (d.pocketed || d.isSinking) continue;
                this.checkPocket(d);
            }
        }
    }

    resolveDiscCollision(d1, d2) {
        const dx = d2.pos.x - d1.pos.x;
        const dy = d2.pos.y - d1.pos.y;
        const distSq = dx * dx + dy * dy;
        const minDist = d1.radius + d2.radius;

        if (distSq < minDist * minDist && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;

            // Positional correction to prevent overlap sticking
            const overlap = minDist - dist;
            const totalInvMass = d1.invMass + d2.invMass;
            if (totalInvMass > 0) {
                const move1 = (overlap * (d1.invMass / totalInvMass));
                const move2 = (overlap * (d2.invMass / totalInvMass));
                d1.pos.x -= nx * move1;
                d1.pos.y -= ny * move1;
                d2.pos.x += nx * move2;
                d2.pos.y += ny * move2;
            }

            // Relative velocity
            const rvx = d2.vel.x - d1.vel.x;
            const rvy = d2.vel.y - d1.vel.y;

            // Velocity along normal
            const velAlongNormal = rvx * nx + rvy * ny;

            // Do not resolve if velocities are separating
            if (velAlongNormal > 0) return;

            // Impulse scalar
            const j = -(1 + this.restitution) * velAlongNormal / totalInvMass;

            // Apply impulse
            d1.vel.x -= (j * d1.invMass) * nx;
            d1.vel.y -= (j * d1.invMass) * ny;
            d2.vel.x += (j * d2.invMass) * nx;
            d2.vel.y += (j * d2.invMass) * ny;

            // Play collision sound
            const hitIntensity = Math.min(Math.abs(velAlongNormal) / 10, 1.0);
            if (hitIntensity > 0.05 && this.audio) {
                this.audio.playCoinHit(hitIntensity);
            }
        }
    }

    resolveWallCollision(disc) {
        const minX = this.config.boardMargin + disc.radius;
        const maxX = this.config.boardWidth - this.config.boardMargin - disc.radius;
        const minY = this.config.boardMargin + disc.radius;
        const maxY = this.config.boardHeight - this.config.boardMargin - disc.radius;

        let bounced = false;
        let speed = 0;

        if (disc.pos.x < minX) {
            disc.pos.x = minX;
            speed = Math.abs(disc.vel.x);
            disc.vel.x = -disc.vel.x * this.wallRestitution;
            bounced = true;
        } else if (disc.pos.x > maxX) {
            disc.pos.x = maxX;
            speed = Math.abs(disc.vel.x);
            disc.vel.x = -disc.vel.x * this.wallRestitution;
            bounced = true;
        }

        if (disc.pos.y < minY) {
            disc.pos.y = minY;
            speed = Math.max(speed, Math.abs(disc.vel.y));
            disc.vel.y = -disc.vel.y * this.wallRestitution;
            bounced = true;
        } else if (disc.pos.y > maxY) {
            disc.pos.y = maxY;
            speed = Math.max(speed, Math.abs(disc.vel.y));
            disc.vel.y = -disc.vel.y * this.wallRestitution;
            bounced = true;
        }

        if (bounced && speed > 0.5 && this.audio) {
            this.audio.playWallBounce(Math.min(speed / 12, 1.0));
        }
    }

    checkPocket(disc) {
        for (let i = 0; i < this.pockets.length; i++) {
            const pocket = this.pockets[i];
            const dist = disc.pos.dist(pocket.pos);

            // If coin overlaps pocket mouth
            if (dist < pocket.radius + disc.radius * 0.5) {
                // If disc center is well inside pocket trigger radius, begin sinking
                if (dist < pocket.radius) {
                    disc.isSinking = true;
                    disc.sinkTarget = pocket.pos.clone();

                    if (this.audio) {
                        this.audio.playPocketSink(disc.isQueen);
                    }

                    if (this.onPocketedCallback) {
                        this.onPocketedCallback(disc);
                    }
                    break;
                }
            }
        }
    }

    areAllDiscsStopped() {
        for (let i = 0; i < this.discs.length; i++) {
            if (this.discs[i].isMoving()) {
                return false;
            }
        }
        return true;
    }
}

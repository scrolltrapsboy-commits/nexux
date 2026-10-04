/**
 * Manages the mancala board
 */
var Mancala = (function () {
  'use strict';

  var Mancala = function (game) {
    this.game = game;
    this.current_pits = [4, 4, 4, 4, 4, 4];
    this.other_pits = [4, 4, 4, 4, 4, 4];
    this.current_store = 0;
    this.other_store = 0;
  };

  Mancala.prototype.flip_board = function () {
    var current_pits = this.current_pits;
    this.current_pits = this.other_pits;
    this.other_pits = current_pits;

    var current_store = this.current_store;
    this.current_store = this.other_store;
    this.other_store = current_store;
  };

  Mancala.prototype.get_stones = function (pit) {
    if (pit === 6) return this.current_store;
    if (pit === 13) return this.other_store;
    if (pit < 6) return this.current_pits[pit];
    if (pit > 6) return this.other_pits[pit - 7];
    return NaN;
  };

  Mancala.prototype.set_stones = function (pit, stones) {
    if (pit === 6) this.current_store = stones;
    else if (pit === 13) this.other_store = stones;
    else if (pit < 6) this.current_pits[pit] = stones;
    else if (pit > 6) this.other_pits[pit - 7] = stones;
  };

  Mancala.prototype.add_stones = function (pit, stones) {
    if (pit === 6) this.current_store += stones;
    else if (pit < 6) this.current_pits[pit] += stones;
    else if (pit > 6 && pit < 13) this.other_pits[pit - 7] += stones;
  };

  return Mancala;
})();

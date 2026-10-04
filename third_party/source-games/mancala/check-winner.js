(function () {
  'use strict';

  Mancala.prototype.check_winner = function () {
    var is_row_empty = function (pits) {
      return pits.every(function (stones) { return stones === 0; });
    };

    var current_player_out = is_row_empty(this.current_pits);
    var other_player_out = is_row_empty(this.other_pits);

    if (!current_player_out && !other_player_out) return -1;

    var pit;
    if (current_player_out && !other_player_out) {
      for (pit = 0; pit < 6; pit++) {
        this.other_store += this.other_pits[pit];
        this.other_pits[pit] = 0;
      }
    } else if (other_player_out && !current_player_out) {
      for (pit = 0; pit < 6; pit++) {
        this.current_store += this.current_pits[pit];
        this.current_pits[pit] = 0;
      }
    }

    this.game.draw_all_stones();

    if (this.current_store > this.other_store) return this.game.player === 'two' ? 2 : 1;
    if (this.other_store > this.current_store) return this.game.player === 'two' ? 1 : 2;
    return 0;
  };
})();

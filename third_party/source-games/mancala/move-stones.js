(function () {
  'use strict';

  Mancala.prototype.move_stones = function (pit) {
    if (this.get_stones(pit) < 1) return false;

    var stones = this.get_stones(pit);
    this.set_stones(pit, 0);
    this.game.draw_stones(pit);

    while (stones > 0) {
      ++pit;
      if (pit > 12) pit = 0;
      this.add_stones(pit, 1);
      stones--;
      this.game.draw_stones(pit);
    }

    var inverse = 5 - pit;

    if (pit < 6 && this.current_pits[pit] === 1 && this.other_pits[inverse] > 0) {
      this.current_store += this.other_pits[inverse] + 1;
      this.game.draw_stones(6);
      this.current_pits[pit] = 0;
      this.other_pits[inverse] = 0;
      this.game.draw_stones(pit);
      this.game.draw_stones(12 - pit);
    }

    return pit !== 6;
  };
})();

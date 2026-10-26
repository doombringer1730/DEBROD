// A browser frontend for DoomPDF's doomgeneric: the same engine that runs in
// the PDF, drawing to a <canvas> instead of rows of text fields. The page
// side (Games.html) supplies Module.drawFrame and Module.nextKey.

#include <emscripten.h>
#include <stdint.h>
#include "doomgeneric.h"

// DoomPDF's d_main.c reads this to skip the screen wipe on the first frame.
int frame_count = 0;

void DG_Init() {}

void DG_SleepMs(uint32_t ms) {}

uint32_t DG_GetTicksMs() {
  return (uint32_t)emscripten_get_now();
}

int DG_GetKey(int* pressed, unsigned char* doomKey) {
  int data = EM_ASM_INT({ return Module.nextKey(); });
  if (!data) return 0;
  *pressed = (data >> 8) & 1;
  *doomKey = data & 0xFF;
  return 1;
}

void DG_SetWindowTitle(const char* title) {}

void DG_DrawFrame() {
  EM_ASM({ Module.drawFrame($0, $1, $2); }, DG_ScreenBuffer, DOOMGENERIC_RESX, DOOMGENERIC_RESY);
}

static void tick() {
  doomgeneric_Tick();
  frame_count++;
}

int main(int argc, char** argv) {
  doomgeneric_Create(argc, argv);
  emscripten_set_main_loop(tick, 0, 1);
  return 0;
}

// C based loader of compiled subfly for UNIX like systems.

#include <unistd.h>
#include <sys/stat.h>
#include <sys/mman.h>
#include <stdio.h>
#include <fcntl.h>

int
main(int argc, char* argv[]) {
  struct stat st;
  
  if ( stat("test.x86", &st) ) {
    perror("stat");
    return 1;
  }

  int fd = open("test.x86", O_RDONLY);

  if ( fd == -1 ) {
    perror("open");
    return 1;
  }

  void* image = mmap(NULL, st.st_size, PROT_READ | PROT_WRITE | PROT_EXEC, MAP_PRIVATE, fd, 0);

  if ( image == NULL ) {
    perror("mmap");
    return 1;
  }
  
  void (*fn)() = image;
  
  fn();

  return 0;
}

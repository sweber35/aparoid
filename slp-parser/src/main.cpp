#include <algorithm>
#include <sys/stat.h>
#include <filesystem>
#include <iostream>

#include <arrow/api.h>
#include <parquet/arrow/writer.h>
#include <arrow/util/logging.h>
#include <arrow/status.h>
#include <arrow/result.h>
#include <arrow/io/file.h>
#include <parquet/exception.h>
#include <arrow/util/config.h>

#include "util.h"
#include "parser.h"
#include "analyzer.h"

#ifndef ARROW_THROW_NOT_OK
#define ARROW_THROW_NOT_OK(expr)             \
  do {                                       \
    ::arrow::Status _s = (expr);             \
    if (!_s.ok()) {                          \
      throw std::runtime_error(_s.ToString()); \
    }                                        \
  } while (0)
#endif

// #define GUI_ENABLED 1  //debug, normally enable this from the makefile

#if GUI_ENABLED == 1
  #include "portable-file-dialogs.h"
#endif

typedef std::filesystem::directory_iterator            f_iter;
typedef std::filesystem::directory_entry               f_entry;
typedef std::vector<std::__cxx11::basic_string<char> > str_vec;

namespace slip {

int _debug = 0;  //used to conform to macro in Util.h


// https://stackoverflow.com/questions/865668/how-to-parse-command-line-arguments-in-c
char* getCmdOption(char ** begin, char ** end, const std::string & option) {
  char ** itr = std::find(begin, end, option);
  if (itr != end && ++itr != end) {
    return *itr;
  }
  return 0;
}

bool cmdOptionExists(char** begin, char** end, const std::string& option) {
  return std::find(begin, end, option) != end;
}

#if GUI_ENABLED == 1
  bool askYesNo(std::string title, std::string question) {
    return pfd::message(title, question, pfd::choice::yes_no, pfd::icon::question).result()==pfd::button::yes;
  }
#endif

void printUsage() {
  std::cout
    << "Usage: slippc -i <infile> [-j <jsonfile>] [-a <analysisfile>] [-f] [-d <debuglevel>] [-h]:" << std::endl
    << "  -i        Set input file (can be .slp or a whole directory)" << std::endl
    << "  -j        Output <infile> in .json format to <jsonfile> (use \"-\" for stdout)" << std::endl
    << "  -a        Output an analysis of <infile> in .json format to <analysisfile> (use \"-\" for stdout)" << std::endl
    << "  -f        When used with -j <jsonfile>, write full frame info (instead of just frame deltas)" << std::endl
    << std::endl
    << "Debug options:" << std::endl
    << "  -d           Run at debug level <debuglevel> (show debug output)" << std::endl
    << "  -h           Show this help message" << std::endl
    ;
}

typedef struct _cmdoptions {
  char* dlevel       = nullptr;
  char* infile       = nullptr;
  char* outfile      = nullptr;
  char* analysisfile = nullptr;
  bool  nodelta      = false;
  bool  dirmode      = false;
  int   debug        = 0;
} cmdoptions;

cmdoptions getCommandLineOptions(int argc, char** argv) {
  _cmdoptions c;
  c.dlevel       = getCmdOption(   argv, argv+argc, "-d");
  c.infile       = getCmdOption(   argv, argv+argc, "-i");
  c.outfile      = getCmdOption(   argv, argv+argc, "-j");
  c.analysisfile = getCmdOption(   argv, argv+argc, "-a");
  c.nodelta      = cmdOptionExists(argv, argv+argc, "-f");
  c.dirmode      = isDirectory(c.infile);

  if (c.dlevel) {
    if (c.dlevel[0] >= '0' && c.dlevel[0] <= '9') {
      c.debug = c.dlevel[0]-'0';
      _debug  = c.debug;
    } else {
      c.debug = 1;
      _debug  = c.debug;
      std::cerr << "Warning: invalid debug level" << std::endl;
    }
  }

  if (c.debug) {
    DOUT1("Running at debug level " << +c.debug);
  }

  return c;
}

#if GUI_ENABLED == 1
  void getGUIOptions(cmdoptions &c) {
    if (_debug < 1) {
      _debug = 1;  //force some debug output
    }
    std::string save, saveext;
    str_vec file_res = pfd::open_file(
      "Select an input File", ".", {"Slippi Files", "*.slp"}).result();
    if(file_res.empty()) {
      printUsage();
      return "";
    }
    stringtoChars(file_res[0],&c.infile);

    std::string inbase = getFileBase(file_res[0]);
    std::string inext  = getFileExt(file_res[0]);

    if (inext.compare("slp") == 0) {
      if (askYesNo("Analysis?", "Output analysis JSON (yes) or regular JSON (no)?")) {
        DOUT1("GUI mode, analysis output");
        save = pfd::save_file("Select an Output file", inbase+".json", { "JSON Files", "*.json"}).result();
        stringtoChars(save,&c.analysisfile);
      } else {
        DOUT1("GUI mode, JSON output");
        save = pfd::save_file("Select an Output file", inbase+".json", { "JSON Files", "*.json"}).result();
        stringtoChars(save,&c.outfile);
      }
    }
  }
#endif

inline void copyCommandOptions(const cmdoptions &c, cmdoptions &c2) {
  memcpy(&c2,&c,sizeof(cmdoptions));
}

inline void cleanupCommandOptions(cmdoptions &c) {
  if(c.infile) {
    delete[] c.infile;
  }
  if(c.outfile) {
    delete[] c.outfile;
  }
}



int handleAnalysis(const cmdoptions &c, const int debug, slip::Parser &p) {
  DOUT1(" Analyzing");
  slip::Analysis *a  = p.analyze();

  if (a->success) {
    if (c.analysisfile[0] == '-' && c.analysisfile[1] == '\0') {
      if (debug) {
        DOUT1("  Writing analysis to stdout");
      }
      std::cout << a->asJson() << std::endl;
    } else {
      if (debug) {
        DOUT1("  Saving analysis to file");
      }
      a->save(c.outfile);
    }
  }

  delete a;
  return 0;
}

int handleJson(const cmdoptions &c, const int debug, slip::Parser &p) {
  DOUT1(" Writing JSON");
  if (c.outfile[0] == '-' && c.outfile[1] == '\0') {
    if (debug) {
      DOUT1("  Writing Slippi JSON data to stdout");
    }
//     std::cout << p.asJson(!c.nodelta) << std::endl;
  } else {
    if (debug) {
      DOUT1("  Saving Slippi JSON data to file");
    }
    p.save(c.outfile, c.infile, !c.nodelta);
  }
  return 0;
}

int handleSingleFile(const cmdoptions &c, const int debug) {
  int reta = 0;  //return value from analysis phase
  int retj = 0;  //return value from jsonoutput phase

  if (c.outfile || c.analysisfile) {
    DOUT1(" Parsing");
    slip::Parser p(debug);
    if (not p.load((std::string("/tmp/") + c.infile).c_str())) {
      FAIL("    Could not load input; exiting");
      return 2;
    }

    if (c.outfile) {
      retj = handleJson(c,debug,p);
    }
    if (c.analysisfile) {
      reta = handleAnalysis(c,debug,p);
    }
  }

  if (debug) {
    DOUT1(" Cleaning up");
  }
  return reta+retj;
}

int handleDirectory(const cmdoptions &c, const int debug) {
  // verify all of our input and output directories are valid (not files + proper write permissions)
  if (!(c.outfile || c.analysisfile)) {
    FAIL("No output directories specified with -j or -a");
    return -2;
  }
  if (c.outfile && (!makeDirectoryIfNotExists(c.outfile))) {
    FAIL("JSON output directory '" << c.outfile << "' is not a valid directory");
    return -2;
  }
  if (c.analysisfile && (!makeDirectoryIfNotExists(c.analysisfile))) {
    FAIL("Analysis output directory '" << c.analysisfile << "' is not a valid directory");
    return -2;
  }

  // find all slippi files in a directory
  for (const f_entry & entry : f_iter(std::string(c.infile))) {
    std::string base  = entry.path().filename();
    std::string noext = entry.path().stem();
    if (getFileExt(base).compare("slp") == 0) {
      cmdoptions c2;
      copyCommandOptions(c,c2);
      stringtoChars((entry.path()).string(),&(c2.infile));
      if(c2.outfile) {
        stringtoChars((PATH(c.outfile) / PATH(base+".json")).string(),&(c2.outfile));
      }
      if(c2.analysisfile) {
        stringtoChars((PATH(c.analysisfile) / PATH(noext+"-analysis.json")).string(),&(c2.analysisfile));
      }
      // std::cout << "  -i "   << c2.infile << std::endl;
      // std::cout << "    -X " << c2.cfile << std::endl;
      // std::cout << "    -j " << c2.outfile << std::endl;
      // std::cout << "    -a " << c2.analysisfile << std::endl;
      INFO("Processing file " << CYN << c2.infile << BLN);
      int ret = handleSingleFile(c2,debug);
      if (ret != 0) {
        WARN("  Encountered errors processing input file " << RED << c2.infile << BLN);
      }
      cleanupCommandOptions(c2);
    }
  }
  return 0;
}

int run(int argc, char** argv) {
  if (cmdOptionExists(argv, argv+argc, "-h")) {
    printUsage();
    return 0;
  }

  cmdoptions c = getCommandLineOptions(argc,argv);

  #if GUI_ENABLED == 1
    if (not c.infile) { //if we don't have an input file, open file selector
      getGUIOptions(c);
    }
  #endif

  if (not c.infile) { //if we still don't have an input file, exit
    WARN("No input selected");
    printUsage();
    return -1;
  }

  if(isDirectory(c.infile)) {
    return handleDirectory(c,c.debug);
  }
  return handleSingleFile(c,c.debug);
}

void write_parquet_test() {
  arrow::Int32Builder builder;

  ARROW_THROW_NOT_OK(builder.Append(10));
  ARROW_THROW_NOT_OK(builder.Append(20));
  ARROW_THROW_NOT_OK(builder.Append(30));

  std::shared_ptr<arrow::Array> array;
  ARROW_THROW_NOT_OK(builder.Finish(&array));

  auto schema = arrow::schema({arrow::field("example", arrow::int32())});
  auto table = arrow::Table::Make(schema, {array});

  std::shared_ptr<arrow::io::FileOutputStream> outfile;
  PARQUET_ASSIGN_OR_THROW(
      outfile,
      arrow::io::FileOutputStream::Open("/tmp/example.parquet")
  );

  PARQUET_THROW_NOT_OK(parquet::arrow::WriteTable(*table, arrow::default_memory_pool(), outfile, 1024));
}

}

int main(int argc, char** argv) {
  try {
    std::cout << "Arrow version: " << ARROW_VERSION_STRING << std::endl;
    return slip::run(argc,argv);
  }
  catch (const std::exception& e) {
    std::cerr << "[FATAL std::exception] " << e.what() << std::endl;
      return 1;
    } catch (...) {
      std::cerr << "[FATAL unknown exception]" << std::endl;
      return 1;
    }
}

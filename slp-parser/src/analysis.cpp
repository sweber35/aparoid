#include <iostream>
#include <iomanip>
#include <arrow/api.h>
#include <arrow/io/file.h>
#include <parquet/arrow/writer.h>
#include <vector>
#include <memory>
#include <fstream>

#include "analysis.h"

//JSON Output shortcuts
#define JFLT(i,k,n) SPACE[ILEV*(i)] << "\"" << (k) << "\": " << float(n)
#define JINT(i,k,n) SPACE[ILEV*(i)] << "\"" << (k) << "\": " << int32_t(n)
#define JUIN(i,k,n) SPACE[ILEV*(i)] << "\"" << (k) << "\": " << uint32_t(n)
#define JSTR(i,k,s) SPACE[ILEV*(i)] << "\"" << (k) << "\": \"" << (s) << "\""
#define JEND(a) ((a++ == 0) ? "\n" : ",\n")

#define JLFLT(k,n) " " << "\"" << (k) << "\": " << float(n)
#define JLINT(k,n) " " << "\"" << (k) << "\": " << int32_t(n)
#define JLUIN(k,n) " " << "\"" << (k) << "\": " << uint32_t(n)
#define JLSTR(k,s) " " << "\"" << (k) << "\": \"" << (s) << "\""
#define JLEND(a) ((a++ == 0) ? "" : ",")

namespace slip {

std::string Analysis::statsAsJson() {
  int a = 0;
  std::stringstream ss;
  ss << "{";
  ss << JEND(a) << JSTR(2,"original_file",    escape_json(original_file));
  ss << JEND(a) << JSTR(2,"slippi_version",   slippi_version);
  ss << JEND(a) << JSTR(2,"parser_version",   parser_version);
  ss << JEND(a) << JSTR(2,"analyzer_version", analyzer_version);
  ss << JEND(a) << JUIN(2,"parse_errors",     parse_errors);
  ss << JEND(a) << JSTR(2,"game_time",        game_time);
  ss << JEND(a) << JUIN(2,"stage_id",         stage_id);
  ss << JEND(a) << JSTR(2,"stage_name",       stage_name);
  ss << JEND(a) << JUIN(2,"game_length",      game_length);
  ss << JEND(a) << JUIN(2,"winner_port",      winner_port);
  ss << JEND(a) << JUIN(2,"start_minutes",    timer);
  ss << JEND(a) << JUIN(2,"end_type",         end_type);
  ss << JEND(a) << JINT(2,"lras",             lras_player);
  ss << JEND(a) << "  " << "\"players\": [\n";
  for(unsigned p = 0; p < 2; ++p) {
    ss << "    " << "{";
    a = 0;
    ss << JEND(a) << JUIN(6,"port",                   ap[p].port);
    ss << JEND(a) << JSTR(6,"tag_player",             escape_json(ap[p].tag_player));
    ss << JEND(a) << JSTR(6,"tag_css",                escape_json(ap[p].tag_css));
    ss << JEND(a) << JSTR(6,"tag_code",               escape_json(ap[p].tag_code));
    ss << JEND(a) << JUIN(6,"char_id",                ap[p].char_id);
    ss << JEND(a) << JSTR(6,"char_name",              ap[p].char_name);
    ss << JEND(a) << JUIN(6,"player_type" ,           ap[p].player_type);
    ss << JEND(a) << JUIN(6,"cpu_level" ,             ap[p].cpu_level);
    ss << JEND(a) << JUIN(6,"color"       ,           ap[p].color);
    ss << JEND(a) << JUIN(6,"team_id"     ,           ap[p].team_id);
    ss << JEND(a) << JUIN(6,"start_stocks",           ap[p].start_stocks);
    ss << JEND(a) << JUIN(6,"end_stocks",             ap[p].end_stocks);
    ss << JEND(a) << JUIN(6,"end_pct",                ap[p].end_pct);
    ss << JEND(a) << JUIN(6,"airdodges",              ap[p].airdodges);
    ss << JEND(a) << JUIN(6,"spotdodges",             ap[p].spotdodges);
    ss << JEND(a) << JUIN(6,"rolls",                  ap[p].rolls);
    ss << JEND(a) << JUIN(6,"dashdances",             ap[p].dashdances);
    ss << JEND(a) << JUIN(6,"l_cancels_hit",          ap[p].l_cancels_hit);
    ss << JEND(a) << JUIN(6,"l_cancels_missed",       ap[p].l_cancels_missed);
    ss << JEND(a) << JUIN(6,"techs",                  ap[p].techs);
    ss << JEND(a) << JUIN(6,"walltechs",              ap[p].walltechs);
    ss << JEND(a) << JUIN(6,"walljumps",              ap[p].walljumps);
    ss << JEND(a) << JUIN(6,"walltechjumps",          ap[p].walltechjumps);
    ss << JEND(a) << JUIN(6,"missed_techs",           ap[p].missed_techs);
    ss << JEND(a) << JUIN(6,"ledge_grabs",            ap[p].ledge_grabs);
    ss << JEND(a) << JUIN(6,"air_frames",             ap[p].air_frames);
    ss << JEND(a) << JUIN(6,"wavedashes",             ap[p].wavedashes);
    ss << JEND(a) << JUIN(6,"wavelands",              ap[p].wavelands);
    ss << JEND(a) << JUIN(6,"neutral_wins",           ap[p].neutral_wins);
    ss << JEND(a) << JUIN(6,"pokes",                  ap[p].pokes);
    ss << JEND(a) << JUIN(6,"counters",               ap[p].counters);
    ss << JEND(a) << JUIN(6,"powershields",           ap[p].powershields);
    ss << JEND(a) << JUIN(6,"shield_breaks",          ap[p].shield_breaks);
    ss << JEND(a) << JUIN(6,"grabs",                  ap[p].grabs);
    ss << JEND(a) << JUIN(6,"grab_escapes",           ap[p].grab_escapes);
    ss << JEND(a) << JUIN(6,"taunts",                 ap[p].taunts);
    ss << JEND(a) << JUIN(6,"meteor_cancels",         ap[p].meteor_cancels);
    ss << JEND(a) << JFLT(6,"damage_dealt",           ap[p].damage_dealt);
    ss << JEND(a) << JUIN(6,"hits_blocked",           ap[p].hits_blocked);
    ss << JEND(a) << JUIN(6,"shield_stabs",           ap[p].shield_stabs);
    ss << JEND(a) << JUIN(6,"edge_cancel_aerials",    ap[p].edge_cancel_aerials);
    ss << JEND(a) << JUIN(6,"edge_cancel_specials",   ap[p].edge_cancel_specials);
    ss << JEND(a) << JUIN(6,"teeter_cancel_aerials",  ap[p].teeter_cancel_aerials);
    ss << JEND(a) << JUIN(6,"teeter_cancel_specials", ap[p].teeter_cancel_specials);
    ss << JEND(a) << JUIN(6,"phantom_hits",           ap[p].phantom_hits);
    ss << JEND(a) << JUIN(6,"no_impact_lands",        ap[p].no_impact_lands);
    ss << JEND(a) << JUIN(6,"shield_drops",           ap[p].shield_drops);
    ss << JEND(a) << JUIN(6,"pivots",                 ap[p].pivots);
    ss << JEND(a) << JUIN(6,"reverse_edgeguards",     ap[p].reverse_edgeguards);
    ss << JEND(a) << JUIN(6,"self_destructs",         ap[p].self_destructs);
    ss << JEND(a) << JUIN(6,"stage_spikes",           ap[p].stage_spikes);
    ss << JEND(a) << JUIN(6,"short_hops",             ap[p].short_hops);
    ss << JEND(a) << JUIN(6,"full_hops",              ap[p].full_hops);
    ss << JEND(a) << JUIN(6,"shield_time",            ap[p].shield_time);
    ss << JEND(a) << JFLT(6,"shield_damage",          ap[p].shield_damage);
    ss << JEND(a) << JFLT(6,"shield_lowest",          ap[p].shield_lowest);
    ss << JEND(a) << JUIN(6,"total_openings",         ap[p].total_openings);
    ss << JEND(a) << JFLT(6,"mean_kill_openings",     ap[p].mean_kill_openings);
    ss << JEND(a) << JFLT(6,"mean_kill_percent",      ap[p].mean_kill_percent);
    ss << JEND(a) << JFLT(6,"mean_opening_percent",   ap[p].mean_opening_percent);
    ss << JEND(a) << JUIN(6,"galint_ledgedashes",     ap[p].galint_ledgedashes);
    ss << JEND(a) << JFLT(6,"mean_galint",            ap[p].mean_galint);
    ss << JEND(a) << JUIN(6,"max_galint",             ap[p].max_galint);
    ss << JEND(a) << JUIN(6,"button_count",           ap[p].button_count);
    ss << JEND(a) << JUIN(6,"cstick_count",           ap[p].cstick_count);
    ss << JEND(a) << JUIN(6,"astick_count",           ap[p].astick_count);
    ss << JEND(a) << JFLT(6,"actions_per_min",        ap[p].apm);
    ss << JEND(a) << JUIN(6,"state_changes",          ap[p].state_changes);
    ss << JEND(a) << JFLT(6,"states_per_min",         ap[p].aspm);
    ss << JEND(a) << JUIN(6,"shieldstun_times",       ap[p].shieldstun_times);
    ss << JEND(a) << JUIN(6,"shieldstun_act_frames",  ap[p].shieldstun_act_frames);
    ss << JEND(a) << JUIN(6,"hitstun_times",          ap[p].hitstun_times);
    ss << JEND(a) << JUIN(6,"hitstun_act_frames",     ap[p].hitstun_act_frames);
    ss << JEND(a) << JUIN(6,"wait_times",             ap[p].wait_times);
    ss << JEND(a) << JUIN(6,"wait_act_frames",        ap[p].wait_act_frames);
    ss << JEND(a) << JUIN(6,"used_norm_moves",        ap[p].used_norm_moves);
    ss << JEND(a) << JUIN(6,"used_spec_moves",        ap[p].used_spec_moves);
    ss << JEND(a) << JUIN(6,"used_misc_moves",        ap[p].used_misc_moves);
    ss << JEND(a) << JUIN(6,"used_grabs",             ap[p].used_grabs);
    ss << JEND(a) << JUIN(6,"used_pummels",           ap[p].used_pummels);
    ss << JEND(a) << JUIN(6,"used_throws",            ap[p].used_throws);
    ss << JEND(a) << JUIN(6,"total_moves_used",       ap[p].total_moves_used);
    ss << JEND(a) << JUIN(6,"total_moves_landed",     ap[p].total_moves_landed);
    ss << JEND(a) << JFLT(6,"move_accuracy",          ap[p].move_accuracy);
    ss << JEND(a) << JFLT(6,"actionability",          ap[p].actionability);
    ss << JEND(a) << JFLT(6,"neutral_wins_per_min",   ap[p].neutral_wins_per_min);
    ss << JEND(a) << JFLT(6,"mean_death_percent",     ap[p].mean_death_percent);

    ss << JEND(a) <<  "      " << "\"interaction_frames\": {\n";
    for(unsigned d = Dynamic::__LAST-1; d > 0; --d) {
      ss << JUIN(8,Dynamic::name[d], ap[p].dyn_counts[d]) << ((d == 1) ? "\n" : ",\n");
    }
    ss << "      " << "},\n";

    ss << "      " << "\"interaction_damage\": {\n";
    for(unsigned d = Dynamic::__LAST-1; d > 0; --d) {
      ss << JFLT(8,Dynamic::name[d], ap[p].dyn_damage[d]) << ((d == 1) ? "\n" : ",\n");
    }
    ss << "      " << "},\n";

    ss << "      " << "\"moves_landed\": {\n";
    unsigned _total_moves = 0;
    for(unsigned d = 0; d < Move::BUBBLE; ++d) {
      if ((ap[p].move_counts[d]) > 0) {
        ss << JUIN(8,Move::name[d], ap[p].move_counts[d]) << ",\n";
        _total_moves += ap[p].move_counts[d];
      }
    }
    ss << JUIN(8,"_total", _total_moves) << "\n";
    ss << "      " << "}\n";

    ss << "    " << "}" << ( p== 0 ? ",\n" : "\n");
  }
  ss << "  ]\n";
  ss << "}\n";
  return ss.str();
}

std::string Analysis::attacksAsJson() {
  std::stringstream ss;
  int a = 1;

  for(unsigned p = 0; p < 2; ++p) {
    for(unsigned i = 0; ap[p].attacks[i].frame > 0; ++i) {
      ss << "{";
      ss << JLSTR("match_id",        game_time);
      ss << JLEND(a) << JLSTR("player_id",       ap[p].tag_code);
      ss << JLEND(a) << JLUIN("attack_id",       i);
      ss << JLEND(a) << JLUIN("move_id",         ap[p].attacks[i].move_id);
      ss << JLEND(a) << JLSTR("move_name",       Move::shortname[ap[p].attacks[i].move_id]);
      ss << JLEND(a) << JLUIN("cancel_type",     ap[p].attacks[i].cancel_type);
      ss << JLEND(a) << JLSTR("cancel_name",     Cancel::shortname[ap[p].attacks[i].cancel_type]);
      ss << JLEND(a) << JLUIN("punish_id",       ap[p].attacks[i].punish_id);
      ss << JLEND(a) << JLUIN("hit_id",          ap[p].attacks[i].hit_id);
      ss << JLEND(a) << JLUIN("game_frame",      ap[p].attacks[i].frame);
      ss << JLEND(a) << JLUIN("anim_frame",      ap[p].attacks[i].anim_frame);
      ss << JLEND(a) << JLFLT("damage",          ap[p].attacks[i].damage);
      ss << JLEND(a) << JLSTR("opening",         Dynamic::name[ap[p].attacks[i].opening]);
      ss << JLEND(a) << JLSTR("kill_dir",        Dir::name[ap[p].attacks[i].kill_dir]);
      ss << " }\n";
    }
  }
  return ss.str();
}

arrow::Status Analysis::attacksAsParquet() {

  using arrow::FloatBuilder;
  using arrow::UInt8Builder;
  using arrow::UInt16Builder;
  using arrow::UInt32Builder;
  using arrow::StringBuilder;

  std::shared_ptr<arrow::Schema> schema = arrow::schema({
    arrow::field("match_id", arrow::utf8()),
    arrow::field("player_id", arrow::utf8()),
    arrow::field("attack_id", arrow::uint16()),
    arrow::field("move_id", arrow::uint16()),
    arrow::field("move_name", arrow::utf8()),
    arrow::field("frame", arrow::uint32()),
    arrow::field("punish_id", arrow::uint8()),
    arrow::field("cancel_type", arrow::uint8()),
    arrow::field("cancel_name", arrow::utf8()),
    arrow::field("hit_id", arrow::uint8()),
    arrow::field("anim_frame", arrow::uint32()),
    arrow::field("damage", arrow::float32()),
    arrow::field("opening", arrow::uint8()),
    arrow::field("kill_dir", arrow::utf8()),
  });

  UInt8Builder cancel_type_b, punish_id_b, opening_b, hit_id_b;
  UInt16Builder attack_id_b, move_id_b;
  UInt32Builder anim_frame_b, frame_b;
  StringBuilder match_id_b, player_id_b, move_name_b, cancel_name_b, kill_dir_b;
  FloatBuilder damage_b;

  for(unsigned p = 0; p < 2; ++p) {
    for(unsigned i = 0; ap[p].attacks[i].frame > 0; ++i) {
      match_id_b.Append(game_time);
      player_id_b.Append(ap[p].tag_code);
      attack_id_b.Append(i);
      move_id_b.Append(ap[p].attacks[i].move_id);
      move_name_b.Append(Move::shortname[ap[p].attacks[i].move_id]);
      frame_b.Append(ap[p].attacks[i].frame);
      punish_id_b.Append(ap[p].attacks[i].punish_id);
      cancel_type_b.Append(ap[p].attacks[i].cancel_type);
      cancel_name_b.Append(Cancel::shortname[ap[p].attacks[i].cancel_type]);
      hit_id_b.Append(ap[p].attacks[i].hit_id);
      anim_frame_b.Append(ap[p].attacks[i].anim_frame);
      damage_b.Append(ap[p].attacks[i].damage);
      opening_b.Append(ap[p].attacks[i].opening);
      kill_dir_b.Append(Dir::name[ap[p].attacks[i].kill_dir]);
    }
  }

  std::shared_ptr<arrow::Array> match_id_a, player_id_a, attack_id_a, move_id_a, move_name_a, frame_a, punish_id_a;
  std::shared_ptr<arrow::Array> cancel_type_a, cancel_name_a, hit_id_a, anim_frame_a, damage_a, opening_a, kill_dir_a;

  match_id_b.Finish(&match_id_a);
  player_id_b.Finish(&player_id_a);
  attack_id_b.Finish(&attack_id_a);
  move_id_b.Finish(&move_id_a);
  move_name_b.Finish(&move_name_a);
  frame_b.Finish(&frame_a);
  punish_id_b.Finish(&punish_id_a);
  cancel_type_b.Finish(&cancel_type_a);
  cancel_name_b.Finish(&cancel_name_a);
  hit_id_b.Finish(&hit_id_a);
  anim_frame_b.Finish(&anim_frame_a);
  damage_b.Finish(&damage_a);
  opening_b.Finish(&opening_a);
  kill_dir_b.Finish(&kill_dir_a);

  std::shared_ptr<arrow::Table> table = arrow::Table::Make(schema, {
    match_id_a, player_id_a, attack_id_a, move_id_a, move_name_a,
    frame_a, punish_id_a, cancel_type_a, cancel_name_a,
    hit_id_a, anim_frame_a, damage_a, opening_a, kill_dir_a
  });

  try {
    std::shared_ptr<arrow::io::FileOutputStream> outfile;
    PARQUET_ASSIGN_OR_THROW(outfile, arrow::io::FileOutputStream::Open("/tmp/attacks.parquet"));

    std::shared_ptr<arrow::io::OutputStream> outstream =
      std::static_pointer_cast<arrow::io::OutputStream>(outfile);

    // TODO: switch from to snappy
    std::shared_ptr<parquet::WriterProperties> writer_properties =
      parquet::WriterProperties::Builder()
        .compression(parquet::Compression::UNCOMPRESSED)
        ->build();

    PARQUET_THROW_NOT_OK(
      parquet::arrow::WriteTable(*table, arrow::default_memory_pool(), outstream, 1024, writer_properties)
    );
  } catch (const parquet::ParquetException& e) {
    std::cerr << "[ParquetException] " << e.what() << std::endl;
    return arrow::Status::ExecutionError("ParquetException: ", e.what());
  } catch (const std::exception& e) {
    std::cerr << "[std::exception] " << e.what() << std::endl;
    return arrow::Status::ExecutionError("std::exception: ", e.what());
  } catch (...) {
    std::cerr << "[Unknown error] during Parquet file write." << std::endl;
    return arrow::Status::ExecutionError("Unknown error during Parquet write");
  }

  return arrow::Status::OK();
}

std::string Analysis::punishesAsJson() {
  std::stringstream ss;
  int a = 1;

  for(unsigned p = 0; p < 2; ++p) {
    for(unsigned i = 0; ap[p].punishes[i].num_moves > 0; ++i) {
      ss << "{";
      ss << JLSTR("match_id",        game_time);
      ss << JLEND(a) << JLSTR("player_id",       ap[p].tag_code);
      ss << JLEND(a) << JLUIN("start_frame",     ap[p].punishes[i].start_frame);
      ss << JLEND(a) << JLUIN("end_frame",       ap[p].punishes[i].end_frame);
      ss << JLEND(a) << JLFLT("start_pct",       ap[p].punishes[i].start_pct);
      ss << JLEND(a) << JLFLT("end_pct",         ap[p].punishes[i].end_pct);
      ss << JLEND(a) << JLUIN("stocks",          ap[p].punishes[i].stocks);
      ss << JLEND(a) << JLUIN("num_moves",       ap[p].punishes[i].num_moves);
      ss << JLEND(a) << JLUIN("last_move_id",    ap[p].punishes[i].last_move_id);
      ss << JLEND(a) << JLSTR("last_move_name",  Move::shortname[ap[p].punishes[i].last_move_id]);
      ss << JLEND(a) << JLSTR("kill_dir",        Dir::name[ap[p].punishes[i].kill_dir]);
      //     ss << JSTR(2,"opening",         "UNUSED");
      ss << " }\n";
    }
  }
  return ss.str();
}

arrow::Status Analysis::punishesAsParquet() {

  using arrow::FloatBuilder;
  using arrow::UInt8Builder;
  using arrow::UInt16Builder;
  using arrow::UInt32Builder;
  using arrow::StringBuilder;

  std::shared_ptr<arrow::Schema> schema = arrow::schema({
    arrow::field("match_id", arrow::utf8()),
    arrow::field("player_id", arrow::utf8()),
    arrow::field("start_frame", arrow::uint32()),
    arrow::field("end_frame", arrow::uint32()),
    arrow::field("start_pct", arrow::float32()),
    arrow::field("end_pct", arrow::float32()),
    arrow::field("stocks", arrow::uint8()),
    arrow::field("num_moves", arrow::uint16()),
    arrow::field("last_move_id", arrow::uint16()),
    arrow::field("kill_dir", arrow::utf8()),
  });

  UInt8Builder stocks_b;
  UInt16Builder num_moves_b, last_move_id_b;
  UInt32Builder start_frame_b, end_frame_b;
  StringBuilder match_id_b, player_id_b, kill_dir_b;
  FloatBuilder start_pct_b, end_pct_b;

  for(unsigned p = 0; p < 2; ++p) {
    for(unsigned i = 0; ap[p].attacks[i].frame > 0; ++i) {
      match_id_b.Append(game_time);
      player_id_b.Append(ap[p].tag_code);
      start_frame_b.Append(ap[p].punishes[i].start_frame);
      end_frame_b.Append(ap[p].punishes[i].end_frame);
      start_pct_b.Append(ap[p].punishes[i].start_pct);
      end_pct_b.Append(ap[p].punishes[i].end_pct);
      stocks_b.Append(ap[p].punishes[i].stocks);
      num_moves_b.Append(ap[p].punishes[i].num_moves);
      last_move_id_b.Append(ap[p].punishes[i].last_move_id);
      kill_dir_b.Append(Dir::name[ap[p].punishes[i].kill_dir]);
    }
  }

  std::shared_ptr<arrow::Array> match_id_a, player_id_a, start_frame_a, end_frame_a, start_pct_a, end_pct_a;
  std::shared_ptr<arrow::Array> stocks_a, num_moves_a, last_move_id_a, kill_dir_a;

  match_id_b.Finish(&match_id_a);
  player_id_b.Finish(&player_id_a);
  start_frame_b.Finish(&start_frame_a);
  end_frame_b.Finish(&end_frame_a);
  start_pct_b.Finish(&start_pct_a);
  end_pct_b.Finish(&end_pct_a);
  stocks_b.Finish(&stocks_a);
  num_moves_b.Finish(&num_moves_a);
  last_move_id_b.Finish(&last_move_id_a);
  kill_dir_b.Finish(&kill_dir_a);

  std::shared_ptr<arrow::Table> table = arrow::Table::Make(schema, {
    match_id_a, player_id_a, start_frame_a, end_frame_a, start_pct_a, end_pct_a,
    stocks_a, num_moves_a, last_move_id_a, kill_dir_a
  });

  try {
    std::shared_ptr<arrow::io::FileOutputStream> outfile;
    PARQUET_ASSIGN_OR_THROW(outfile, arrow::io::FileOutputStream::Open("/tmp/punishes.parquet"));

    std::shared_ptr<arrow::io::OutputStream> outstream =
      std::static_pointer_cast<arrow::io::OutputStream>(outfile);

    // TODO: switch from to snappy
    std::shared_ptr<parquet::WriterProperties> writer_properties =
      parquet::WriterProperties::Builder()
        .compression(parquet::Compression::UNCOMPRESSED)
        ->build();

    PARQUET_THROW_NOT_OK(
      parquet::arrow::WriteTable(*table, arrow::default_memory_pool(), outstream, 1024, writer_properties)
    );
  } catch (const parquet::ParquetException& e) {
    std::cerr << "[ParquetException] " << e.what() << std::endl;
    return arrow::Status::ExecutionError("ParquetException: ", e.what());
  } catch (const std::exception& e) {
    std::cerr << "[std::exception] " << e.what() << std::endl;
    return arrow::Status::ExecutionError("std::exception: ", e.what());
  } catch (...) {
    std::cerr << "[Unknown error] during Parquet file write." << std::endl;
    return arrow::Status::ExecutionError("Unknown error during Parquet write");
  }

  return arrow::Status::OK();
}

std::string Analysis::asJson() {
  std::stringstream ss;
  ss << "{" << std::endl;
  int a = 0;
  ss << JEND(a) << JSTR(0,"original_file",    escape_json(original_file));
  ss << JEND(a) << JSTR(0,"slippi_version",   slippi_version);
  ss << JEND(a) << JSTR(0,"parser_version",   parser_version);
  ss << JEND(a) << JSTR(0,"analyzer_version", analyzer_version);
  ss << JEND(a) << JUIN(0,"parse_errors",     parse_errors);
  ss << JEND(a) << JSTR(0,"game_time",        game_time);
  ss << JEND(a) << JUIN(0,"stage_id",         stage_id);
  ss << JEND(a) << JSTR(0,"stage_name",       stage_name);
  ss << JEND(a) << JUIN(0,"game_length",      game_length);
  ss << JEND(a) << JUIN(0,"winner_port",      winner_port);
  ss << JEND(a) << JUIN(0,"start_minutes",    timer);
  ss << JEND(a) << JUIN(0,"end_type",         end_type);
  ss << JEND(a) << JINT(0,"lras",             lras_player);

  ss << "\"players\" : [\n";
  for(unsigned p = 0; p < 2; ++p) {
    ss << SPACE[ILEV] << "{\n";

    ss << JEND(a) << JUIN(1,"port",                   ap[p].port);
    ss << JEND(a) << JSTR(1,"tag_player",             escape_json(ap[p].tag_player));
    ss << JEND(a) << JSTR(1,"tag_css",                escape_json(ap[p].tag_css));
    ss << JEND(a) << JSTR(1,"tag_code",               escape_json(ap[p].tag_code));
    ss << JEND(a) << JUIN(1,"char_id",                ap[p].char_id);
    ss << JEND(a) << JSTR(1,"char_name",              ap[p].char_name);
    ss << JEND(a) << JUIN(1,"player_type" ,           ap[p].player_type);
    ss << JEND(a) << JUIN(1,"cpu_level" ,             ap[p].cpu_level);
    ss << JEND(a) << JUIN(1,"color"       ,           ap[p].color);
    ss << JEND(a) << JUIN(1,"team_id"     ,           ap[p].team_id);
    ss << JEND(a) << JUIN(1,"start_stocks",           ap[p].start_stocks);
    ss << JEND(a) << JUIN(1,"end_stocks",             ap[p].end_stocks);
    ss << JEND(a) << JUIN(1,"end_pct",                ap[p].end_pct);

    ss << JEND(a) << JUIN(1,"airdodges",              ap[p].airdodges);
    ss << JEND(a) << JUIN(1,"spotdodges",             ap[p].spotdodges);
    ss << JEND(a) << JUIN(1,"rolls",                  ap[p].rolls);
    ss << JEND(a) << JUIN(1,"dashdances",             ap[p].dashdances);
    ss << JEND(a) << JUIN(1,"l_cancels_hit",          ap[p].l_cancels_hit);
    ss << JEND(a) << JUIN(1,"l_cancels_missed",       ap[p].l_cancels_missed);
    ss << JEND(a) << JUIN(1,"techs",                  ap[p].techs);
    ss << JEND(a) << JUIN(1,"walltechs",              ap[p].walltechs);
    ss << JEND(a) << JUIN(1,"walljumps",              ap[p].walljumps);
    ss << JEND(a) << JUIN(1,"walltechjumps",          ap[p].walltechjumps);
    ss << JEND(a) << JUIN(1,"missed_techs",           ap[p].missed_techs);
    ss << JEND(a) << JUIN(1,"ledge_grabs",            ap[p].ledge_grabs);
    ss << JEND(a) << JUIN(1,"air_frames",             ap[p].air_frames);
    ss << JEND(a) << JUIN(1,"wavedashes",             ap[p].wavedashes);
    ss << JEND(a) << JUIN(1,"wavelands",              ap[p].wavelands);
    ss << JEND(a) << JUIN(1,"neutral_wins",           ap[p].neutral_wins);
    ss << JEND(a) << JUIN(1,"pokes",                  ap[p].pokes);
    ss << JEND(a) << JUIN(1,"counters",               ap[p].counters);
    ss << JEND(a) << JUIN(1,"powershields",           ap[p].powershields);
    ss << JEND(a) << JUIN(1,"shield_breaks",          ap[p].shield_breaks);
    ss << JEND(a) << JUIN(1,"grabs",                  ap[p].grabs);
    ss << JEND(a) << JUIN(1,"grab_escapes",           ap[p].grab_escapes);
    ss << JEND(a) << JUIN(1,"taunts",                 ap[p].taunts);
    ss << JEND(a) << JUIN(1,"meteor_cancels",         ap[p].meteor_cancels);
    ss << JEND(a) << JFLT(1,"damage_dealt",           ap[p].damage_dealt);
    ss << JEND(a) << JUIN(1,"hits_blocked",           ap[p].hits_blocked);
    ss << JEND(a) << JUIN(1,"shield_stabs",           ap[p].shield_stabs);
    ss << JEND(a) << JUIN(1,"edge_cancel_aerials",    ap[p].edge_cancel_aerials);
    ss << JEND(a) << JUIN(1,"edge_cancel_specials",   ap[p].edge_cancel_specials);
    ss << JEND(a) << JUIN(1,"teeter_cancel_aerials",  ap[p].teeter_cancel_aerials);
    ss << JEND(a) << JUIN(1,"teeter_cancel_specials", ap[p].teeter_cancel_specials);
    ss << JEND(a) << JUIN(1,"phantom_hits",           ap[p].phantom_hits);
    ss << JEND(a) << JUIN(1,"no_impact_lands",        ap[p].no_impact_lands);
    ss << JEND(a) << JUIN(1,"shield_drops",           ap[p].shield_drops);
    ss << JEND(a) << JUIN(1,"pivots",                 ap[p].pivots);
    ss << JEND(a) << JUIN(1,"reverse_edgeguards",     ap[p].reverse_edgeguards);
    ss << JEND(a) << JUIN(1,"self_destructs",         ap[p].self_destructs);
    ss << JEND(a) << JUIN(1,"stage_spikes",           ap[p].stage_spikes);
    ss << JEND(a) << JUIN(1,"short_hops",             ap[p].short_hops);
    ss << JEND(a) << JUIN(1,"full_hops",              ap[p].full_hops);
    ss << JEND(a) << JUIN(1,"shield_time",            ap[p].shield_time);
    ss << JEND(a) << JFLT(1,"shield_damage",          ap[p].shield_damage);
    ss << JEND(a) << JFLT(1,"shield_lowest",          ap[p].shield_lowest);
    ss << JEND(a) << JUIN(1,"total_openings",         ap[p].total_openings);
    ss << JEND(a) << JFLT(1,"mean_kill_openings",     ap[p].mean_kill_openings);
    ss << JEND(a) << JFLT(1,"mean_kill_percent",      ap[p].mean_kill_percent);
    ss << JEND(a) << JFLT(1,"mean_opening_percent",   ap[p].mean_opening_percent);
    ss << JEND(a) << JUIN(1,"galint_ledgedashes",     ap[p].galint_ledgedashes);
    ss << JEND(a) << JFLT(1,"mean_galint",            ap[p].mean_galint);
    ss << JEND(a) << JUIN(1,"max_galint",             ap[p].max_galint);
    ss << JEND(a) << JUIN(1,"button_count",           ap[p].button_count);
    ss << JEND(a) << JUIN(1,"cstick_count",           ap[p].cstick_count);
    ss << JEND(a) << JUIN(1,"astick_count",           ap[p].astick_count);
    ss << JEND(a) << JFLT(1,"actions_per_min",        ap[p].apm);
    ss << JEND(a) << JUIN(1,"state_changes",          ap[p].state_changes);
    ss << JEND(a) << JFLT(1,"states_per_min",         ap[p].aspm);
    ss << JEND(a) << JUIN(1,"shieldstun_times",       ap[p].shieldstun_times);
    ss << JEND(a) << JUIN(1,"shieldstun_act_frames",  ap[p].shieldstun_act_frames);
    ss << JEND(a) << JUIN(1,"hitstun_times",          ap[p].hitstun_times);
    ss << JEND(a) << JUIN(1,"hitstun_act_frames",     ap[p].hitstun_act_frames);
    ss << JEND(a) << JUIN(1,"wait_times",             ap[p].wait_times);
    ss << JEND(a) << JUIN(1,"wait_act_frames",        ap[p].wait_act_frames);
    ss << JEND(a) << JUIN(1,"used_norm_moves",        ap[p].used_norm_moves);
    ss << JEND(a) << JUIN(1,"used_spec_moves",        ap[p].used_spec_moves);
    ss << JEND(a) << JUIN(1,"used_misc_moves",        ap[p].used_misc_moves);
    ss << JEND(a) << JUIN(1,"used_grabs",             ap[p].used_grabs);
    ss << JEND(a) << JUIN(1,"used_pummels",           ap[p].used_pummels);
    ss << JEND(a) << JUIN(1,"used_throws",            ap[p].used_throws);
    ss << JEND(a) << JUIN(1,"total_moves_used",       ap[p].total_moves_used);
    ss << JEND(a) << JUIN(1,"total_moves_landed",     ap[p].total_moves_landed);
    ss << JEND(a) << JFLT(1,"move_accuracy",          ap[p].move_accuracy);
    ss << JEND(a) << JFLT(1,"actionability",          ap[p].actionability);
    ss << JEND(a) << JFLT(1,"neutral_wins_per_min",   ap[p].neutral_wins_per_min);
    ss << JEND(a) << JFLT(1,"mean_death_percent",     ap[p].mean_death_percent);

    ss << SPACE[ILEV] << "\"interaction_frames\" : {\n";
    for(unsigned d = Dynamic::__LAST-1; d > 0; --d) {
      int rounded = static_cast<int>(std::lround(ap[p].dyn_counts[d]));
      ss << JUIN(2,Dynamic::name[d], rounded) << ((d == 1) ? "\n" : ",\n");
    }
    ss << SPACE[ILEV] << "},\n";

    ss << SPACE[ILEV] << "\"interaction_damage\" : {\n";
    for(unsigned d = Dynamic::__LAST-1; d > 0; --d) {
      ss << JFLT(2,Dynamic::name[d], ap[p].dyn_damage[d]) << ((d == 1) ? "\n" : ",\n");
    }
    ss << SPACE[ILEV] << "},\n";

    ss << SPACE[ILEV] << "\"moves_landed\" : {\n";
    unsigned _total_moves = 0;
    for(unsigned d = 0; d < Move::BUBBLE; ++d) {
      if ((ap[p].move_counts[d]) > 0) {
        ss << JUIN(2,Move::name[d], ap[p].move_counts[d]) << ",\n";
        _total_moves += ap[p].move_counts[d];
      }
    }
    ss << JUIN(2,"_total", _total_moves) << "\n";
    ss << SPACE[ILEV] << "},\n";

    ss << SPACE[ILEV] << "\"attacks\" : [\n";
    for(unsigned i = 0; ap[p].attacks[i].frame > 0; ++i) {
      ss << SPACE[2*ILEV] << "{" << std::endl;
      ss << JUIN(2,"move_id",         ap[p].attacks[i].move_id)                        << ",\n";
      ss << JSTR(2,"move_name",       Move::shortname[ap[p].attacks[i].move_id])       << ",\n";
      ss << JUIN(2,"cancel_type",     ap[p].attacks[i].cancel_type)                    << ",\n";
      ss << JSTR(2,"cancel_name",     Cancel::shortname[ap[p].attacks[i].cancel_type]) << ",\n";
      ss << JUIN(2,"punish_id",       ap[p].attacks[i].punish_id)                      << ",\n";
      ss << JUIN(2,"hit_id",          ap[p].attacks[i].hit_id)                         << ",\n";
      ss << JUIN(2,"game_frame",      ap[p].attacks[i].frame)                          << ",\n";
      ss << JUIN(2,"anim_frame",      ap[p].attacks[i].anim_frame)                     << ",\n";
      ss << JFLT(2,"damage",          ap[p].attacks[i].damage)                         << ",\n";
      ss << JSTR(2,"opening",         Dynamic::name[ap[p].attacks[i].opening])         << ",\n";
      ss << JSTR(2,"kill_dir",        Dir::name[ap[p].attacks[i].kill_dir])            << "\n";
      ss << SPACE[2*ILEV] << "}" << ((ap[p].attacks[i+1].frame > 0) ? ",\n" : "\n");
    }
    ss << SPACE[ILEV] << "],\n";

    ss << SPACE[ILEV] << "\"punishes\" : [\n";
    for(unsigned i = 0; ap[p].punishes[i].num_moves > 0; ++i) {
      ss << SPACE[2*ILEV] << "{" << std::endl;
      ss << JUIN(2,"start_frame",     ap[p].punishes[i].start_frame)                   << ",\n";
      ss << JUIN(2,"end_frame",       ap[p].punishes[i].end_frame)                     << ",\n";
      ss << JFLT(2,"start_pct",       ap[p].punishes[i].start_pct)                     << ",\n";
      ss << JFLT(2,"end_pct",         ap[p].punishes[i].end_pct)                       << ",\n";
      ss << JUIN(2,"stocks",          ap[p].punishes[i].stocks)                        << ",\n";
      ss << JUIN(2,"num_moves",       ap[p].punishes[i].num_moves)                     << ",\n";
      ss << JUIN(2,"last_move_id",    ap[p].punishes[i].last_move_id)                  << ",\n";
      ss << JSTR(2,"last_move_name",  Move::shortname[ap[p].punishes[i].last_move_id]) << ",\n";
      ss << JSTR(2,"opening",         "UNUSED")                                        << ",\n";
      ss << JSTR(2,"kill_dir",        Dir::name[ap[p].punishes[i].kill_dir])           << "\n";
      ss << SPACE[2*ILEV] << "}" << ((ap[p].punishes[i+1].num_moves > 0) ? ",\n" : "\n");
    }
    ss << SPACE[ILEV] << "]\n";

    ss << SPACE[ILEV] << "}" << ( p== 0 ? ",\n" : "\n");
  }
  ss << "]\n";
  ss << "}\n";
  return ss.str();
}

void Analysis::save(const char* outfilename) {
//   std::ofstream fout;
//   fout.open(outfilename);
//   std::string j = asJson();
//   fout << j << std::endl;
//   fout.close();
  std::string fileNameWithPath = "/tmp/" + std::string(outfilename);
  std::string statsFileName = fileNameWithPath + "/stats.json";
  std::ofstream fout2;
  fout2.open(statsFileName.c_str());
  std::string j = statsAsJson();
  fout2 << j << std::endl;
  fout2.close();

//   std::string attacksFileName = std::string(outfilename) + "/attacks.jsonl";
//   std::ofstream fout3;
//   fout3.open(attacksFileName.c_str());
//   std::string k = attacksAsJson();
//   fout3 << k << std::endl;
//   fout3.close();

//   std::string punishesFileName = std::string(outfilename) + "/punishes.jsonl";
//   std::ofstream fout4;
//   fout4.open(punishesFileName.c_str());
//   std::string l = punishesAsJson();
//   fout4 << l << std::endl;
//   fout4.close();

  attacksAsParquet();
  punishesAsParquet();
}

}

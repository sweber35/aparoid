#include "replay.h"
#include "util.h"
#include <iostream>
#include <iomanip>
#include <arrow/api.h>
#include <arrow/io/file.h>
#include <parquet/arrow/writer.h>
#include <vector>
#include <memory>
#include <fstream>

//JSON Output shortcuts
#define JFLT(k,n) " \"" << (k) << "\": " << std::fixed << std::setprecision(2) << float(n)
#define JINT(k,n) " " << "\"" << (k) << "\": " << int32_t(n)
#define JUIN(k,n) " " << "\"" << (k) << "\": " << uint32_t(n)
#define JSTR(k,s) " " << "\"" << (k) << "\": \"" << (s) << "\""
//Logic for outputting a line only if it changed since last frame (or if we're in full output mode)
#define CHANGED(field) (not delta) || (f == 0) || (s.player[p].frame[f].field != s.player[p].frame[f-1].field)
#define ICHANGED(field) (not delta) || (f == 0) || (s.item[i].frame[f].field != s.item[i].frame[f-1].field)
//Logic for outputting a comma or not depending on whether we're the first element in a JSON object
#define JEND(a) ((a++ == 0) ? "" : ",")

namespace slip {

void SlippiReplay::setFrames(int32_t max_frames) {
  this->last_frame  = max_frames;
  this->frame_count = max_frames-this->first_frame;
  for(unsigned i = 0; i < 4; ++i) {
    if (this->player[i].player_type != 3) {
      this->player[i].frame = new SlippiFrame[this->frame_count];
      if (this->player[i].ext_char_id == CharExt::CLIMBER) { //Extra player for Ice Climbers
        this->player[i+4].frame = new SlippiFrame[this->frame_count];
      }
    }
  }
}

void SlippiReplay::cleanup() {
  for(unsigned i = 0; i < 4; ++i) {
    if (this->player[i].player_type != 3) {
      delete [] this->player[i].frame;
      if (this->player[i].ext_char_id == CharExt::CLIMBER) { //Extra player for Ice Climbers
        delete [] this->player[i+4].frame;
      }
    }
  }
  for(unsigned i = 0; i < MAX_ITEMS; ++i) {
    if (this->item[i].frame != nullptr) {
      delete [] this->item[i].frame;
    }
  }
}

arrow::Status SlippiReplay::playerFramesAsParquet() {

  SlippiReplay s = (*this);

  uint8_t _slippi_maj = (s.slippi_version_raw >> 24) & 0xff;
  uint8_t _slippi_min = (s.slippi_version_raw >> 16) & 0xff;
  uint8_t _slippi_rev = (s.slippi_version_raw >>  8) & 0xff;

  using arrow::FloatBuilder;
  using arrow::UInt8Builder;
  using arrow::UInt16Builder;
  using arrow::UInt32Builder;
  using arrow::BooleanBuilder;
  using arrow::StringBuilder;

  std::shared_ptr<arrow::Schema> schema = arrow::schema({
    arrow::field("match_id", arrow::utf8()),
    arrow::field("player_id", arrow::utf8()),
    arrow::field("player_index", arrow::uint8()),
    arrow::field("frame_number", arrow::uint32()),
    arrow::field("char_id", arrow::uint8()),
    arrow::field("follower", arrow::boolean()),
    arrow::field("seed", arrow::uint32()),
    arrow::field("ucf_x", arrow::uint8()),
    arrow::field("stocks", arrow::uint8()),
    arrow::field("alive", arrow::boolean()),
    arrow::field("anim_index", arrow::uint32()),
    arrow::field("pos_x_pre", arrow::float32()),
    arrow::field("pos_y_pre", arrow::float32()),
    arrow::field("pos_x_post", arrow::float32()),
    arrow::field("pos_y_post", arrow::float32()),
    arrow::field("joy_x", arrow::float32()),
    arrow::field("joy_y", arrow::float32()),
    arrow::field("c_x", arrow::float32()),
    arrow::field("c_y", arrow::float32()),
    arrow::field("trigger", arrow::float32()),
    arrow::field("buttons", arrow::uint16()),
    arrow::field("phys_l", arrow::float32()),
    arrow::field("phys_r", arrow::float32()),
    arrow::field("shield", arrow::float32()),
    arrow::field("hit_with", arrow::uint8()),
    arrow::field("combo", arrow::uint8()),
    arrow::field("hurt_by", arrow::uint8()),
    arrow::field("percent_pre", arrow::float32()),
    arrow::field("percent_post", arrow::float32()),
    arrow::field("action_pre", arrow::uint16()),
    arrow::field("action_post", arrow::uint16()),
    arrow::field("action_fc", arrow::float32()),
    arrow::field("face_dir_pre", arrow::float32()),
    arrow::field("face_dir_post", arrow::float32()),
    arrow::field("hitstun", arrow::float32()),
    arrow::field("airborne", arrow::boolean()),
    arrow::field("ground_id", arrow::uint16()),
    arrow::field("jumps", arrow::uint8()),
    arrow::field("l_cancel", arrow::uint8()),
    arrow::field("hurtbox", arrow::uint8()),
    arrow::field("hitlag", arrow::float32()),
    arrow::field("self_air_x", arrow::float32()),
    arrow::field("self_air_y", arrow::float32()),
    arrow::field("attack_x", arrow::float32()),
    arrow::field("attack_y", arrow::float32()),
    arrow::field("self_grd_x", arrow::float32()),
  });

  UInt8Builder ucf_x_b, char_id_b, hit_with_b, combo_b, hurt_by_b, stocks_b;
  UInt8Builder jumps_b, l_cancel_b, hurtbox_b, player_index_b;
  UInt16Builder action_pre_b, action_post_b, buttons_b, ground_id_b;
  UInt32Builder frame_number_b, seed_b, anim_index_b;
  FloatBuilder pos_x_pre_b, pos_y_pre_b, joy_x_b, joy_y_b, c_x_b, c_y_b;
  FloatBuilder trigger_b, pos_x_post_b, pos_y_post_b, phys_l_b, phys_r_b;
  FloatBuilder percent_pre_b, percent_post_b, face_dir_pre_b, face_dir_post_b, shield_b;
  FloatBuilder action_fc_b, hitstun_b, self_air_x_b, self_air_y_b;
  FloatBuilder attack_x_b, attack_y_b, self_grd_x_b, hitlag_b;
  BooleanBuilder follower_b, alive_b, airborne_b;
  StringBuilder match_id_b, player_id_b;

  for(unsigned p = 0; p < 8; ++p) {
    unsigned pp = (p % 4);

    if (s.player[p].player_type != 3) {
      for(unsigned f = 0; f < s.frame_count; ++f) {

        match_id_b.Append(s.start_time);
        player_id_b.Append(s.player[pp].tag_code);
        player_index_b.Append(p);
        frame_number_b.Append(f);
        char_id_b.Append(s.player[p].frame[f].char_id);
        follower_b.Append(s.player[p].frame[f].follower);
        seed_b.Append(s.player[p].frame[f].seed);
        pos_x_pre_b.Append(s.player[p].frame[f].pos_x_pre);
        pos_y_pre_b.Append(s.player[p].frame[f].pos_y_pre);
        face_dir_pre_b.Append(s.player[p].frame[f].face_dir_pre);
        joy_x_b.Append(s.player[p].frame[f].joy_x);
        joy_y_b.Append(s.player[p].frame[f].joy_y);
        c_x_b.Append(s.player[p].frame[f].c_x);
        c_y_b.Append(s.player[p].frame[f].c_y);
        trigger_b.Append(s.player[p].frame[f].trigger);
        buttons_b.Append(s.player[p].frame[f].buttons);
        phys_l_b.Append(s.player[p].frame[f].phys_l);
        phys_r_b.Append(s.player[p].frame[f].phys_r);
        ucf_x_b.Append(s.player[p].frame[f].ucf_x);
        percent_pre_b.Append(s.player[p].frame[f].percent_pre);
        action_pre_b.Append(s.player[p].frame[f].action_pre);
        action_post_b.Append(s.player[p].frame[f].action_post);
        pos_x_post_b.Append(s.player[p].frame[f].pos_x_post);
        pos_y_post_b.Append(s.player[p].frame[f].pos_y_post);
        face_dir_post_b.Append(s.player[p].frame[f].face_dir_post);
        percent_post_b.Append(s.player[p].frame[f].percent_post);
        shield_b.Append(s.player[p].frame[f].shield);
        hit_with_b.Append(s.player[p].frame[f].hit_with);
        combo_b.Append(s.player[p].frame[f].combo);
        hurt_by_b.Append(s.player[p].frame[f].hurt_by);
        stocks_b.Append(s.player[p].frame[f].stocks);
        action_fc_b.Append(s.player[p].frame[f].action_fc);

        if(MIN_VERSION(2,0,0)) {
          hitstun_b.Append(s.player[p].frame[f].hitstun);
          airborne_b.Append(s.player[p].frame[f].airborne);
          ground_id_b.Append(s.player[p].frame[f].ground_id);
          jumps_b.Append(s.player[p].frame[f].jumps);
          l_cancel_b.Append(s.player[p].frame[f].l_cancel);
          alive_b.Append(s.player[p].frame[f].alive);
        } else {
          hitstun_b.Append(0);
          airborne_b.Append(false);
          ground_id_b.Append(0);
          jumps_b.Append(0);
          l_cancel_b.Append(0);
          alive_b.Append(false);
        }

        if(MIN_VERSION(2,1,0)) {
          hurtbox_b.Append(s.player[p].frame[f].hurtbox);
        } else {
          hurtbox_b.Append(0);
        }

        if(MIN_VERSION(3,5,0)) {
          self_air_x_b.Append(s.player[p].frame[f].self_air_x);
          self_air_y_b.Append(s.player[p].frame[f].self_air_y);
          attack_x_b.Append(s.player[p].frame[f].attack_x);
          attack_y_b.Append(s.player[p].frame[f].attack_y);
          self_grd_x_b.Append(s.player[p].frame[f].self_grd_x);
        } else {
          self_air_x_b.Append(0);
          self_air_y_b.Append(0);
          attack_x_b.Append(0);
          attack_y_b.Append(0);
          self_grd_x_b.Append(0);
        }

        if(MIN_VERSION(3,8,0)) {
          hitlag_b.Append(s.player[p].frame[f].hitlag);
        } else {
          hitlag_b.Append(0);
        }

        if(MIN_VERSION(3,11,0)) {
          anim_index_b.Append(s.player[p].frame[f].anim_index);
        } else {
          anim_index_b.Append(0);
        }
      }
    }
  }

  std::shared_ptr<arrow::Array> match_id_a, player_id_a, player_index_a, frame_number_a, char_id_a, follower_a, seed_a, ucf_x_a, stocks_a, alive_a, anim_index_a;
  std::shared_ptr<arrow::Array> pos_x_pre_a, pos_y_pre_a, pos_x_post_a, pos_y_post_a, joy_x_a, joy_y_a;
  std::shared_ptr<arrow::Array> c_x_a, c_y_a, trigger_a, buttons_a, phys_l_a, phys_r_a, shield_a;
  std::shared_ptr<arrow::Array> hit_with_a, combo_a, hurt_by_a, percent_pre_a, percent_post_a;
  std::shared_ptr<arrow::Array> action_pre_a, action_post_a, action_fc_a, face_dir_pre_a, face_dir_post_a;
  std::shared_ptr<arrow::Array> hitstun_a, airborne_a, ground_id_a, jumps_a, l_cancel_a, hurtbox_a, hitlag_a;
  std::shared_ptr<arrow::Array> self_air_x_a, self_air_y_a, attack_x_a, attack_y_a, self_grd_x_a;

  match_id_b.Finish(&match_id_a);
  player_id_b.Finish(&player_id_a);
  player_index_b.Finish(&player_index_a);
  frame_number_b.Finish(&frame_number_a);
  char_id_b.Finish(&char_id_a);
  follower_b.Finish(&follower_a);
  seed_b.Finish(&seed_a);
  ucf_x_b.Finish(&ucf_x_a);
  stocks_b.Finish(&stocks_a);
  alive_b.Finish(&alive_a);
  anim_index_b.Finish(&anim_index_a);
  pos_x_pre_b.Finish(&pos_x_pre_a);
  pos_y_pre_b.Finish(&pos_y_pre_a);
  pos_x_post_b.Finish(&pos_x_post_a);
  pos_y_post_b.Finish(&pos_y_post_a);
  joy_x_b.Finish(&joy_x_a);
  joy_y_b.Finish(&joy_y_a);
  c_x_b.Finish(&c_x_a);
  c_y_b.Finish(&c_y_a);
  trigger_b.Finish(&trigger_a);
  buttons_b.Finish(&buttons_a);
  phys_l_b.Finish(&phys_l_a);
  phys_r_b.Finish(&phys_r_a);
  shield_b.Finish(&shield_a);
  hit_with_b.Finish(&hit_with_a);
  combo_b.Finish(&combo_a);
  hurt_by_b.Finish(&hurt_by_a);
  percent_pre_b.Finish(&percent_pre_a);
  percent_post_b.Finish(&percent_post_a);
  action_pre_b.Finish(&action_pre_a);
  action_post_b.Finish(&action_post_a);
  action_fc_b.Finish(&action_fc_a);
  face_dir_pre_b.Finish(&face_dir_pre_a);
  face_dir_post_b.Finish(&face_dir_post_a);
  hitstun_b.Finish(&hitstun_a);
  airborne_b.Finish(&airborne_a);
  ground_id_b.Finish(&ground_id_a);
  jumps_b.Finish(&jumps_a);
  l_cancel_b.Finish(&l_cancel_a);
  hurtbox_b.Finish(&hurtbox_a);
  hitlag_b.Finish(&hitlag_a);
  self_air_x_b.Finish(&self_air_x_a);
  self_air_y_b.Finish(&self_air_y_a);
  attack_x_b.Finish(&attack_x_a);
  attack_y_b.Finish(&attack_y_a);
  self_grd_x_b.Finish(&self_grd_x_a);

  std::shared_ptr<arrow::Table> table = arrow::Table::Make(schema, {
    match_id_a, player_id_a, player_index_a, frame_number_a, char_id_a, follower_a, seed_a, ucf_x_a, stocks_a, alive_a, anim_index_a,
    pos_x_pre_a, pos_y_pre_a, pos_x_post_a, pos_y_post_a, joy_x_a, joy_y_a, c_x_a, c_y_a, trigger_a,
    buttons_a, phys_l_a, phys_r_a, shield_a, hit_with_a, combo_a, hurt_by_a, percent_pre_a,
    percent_post_a, action_pre_a, action_post_a, action_fc_a, face_dir_pre_a, face_dir_post_a, hitstun_a, airborne_a,
    ground_id_a, jumps_a, l_cancel_a, hurtbox_a, hitlag_a,
    self_air_x_a, self_air_y_a, attack_x_a, attack_y_a, self_grd_x_a
  });

  try {
    std::shared_ptr<arrow::io::FileOutputStream> outfile;
    PARQUET_ASSIGN_OR_THROW(outfile, arrow::io::FileOutputStream::Open("/tmp/frames.parquet"));

    std::shared_ptr<arrow::io::OutputStream> outstream =
      std::static_pointer_cast<arrow::io::OutputStream>(outfile);

    // TODO: switch to snappy
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

arrow::Status SlippiReplay::itemFramesAsParquet() {
  SlippiReplay s = (*this);

  uint8_t _slippi_maj = (s.slippi_version_raw >> 24) & 0xff;
  uint8_t _slippi_min = (s.slippi_version_raw >> 16) & 0xff;
  uint8_t _slippi_rev = (s.slippi_version_raw >>  8) & 0xff;

  using arrow::FloatBuilder;
  using arrow::UInt8Builder;
  using arrow::UInt16Builder;
  using arrow::UInt32Builder;
  using arrow::StringBuilder;

  std::shared_ptr<arrow::Schema> schema = arrow::schema({
    arrow::field("match_id", arrow::utf8()),
    arrow::field("spawn_id", arrow::uint32()),
    arrow::field("item_type", arrow::uint16()),
    arrow::field("frame", arrow::uint32()),
    arrow::field("state", arrow::uint8()),
    arrow::field("face_dir", arrow::float32()),
    arrow::field("xvel", arrow::float32()),
    arrow::field("yvel", arrow::float32()),
    arrow::field("xpos", arrow::float32()),
    arrow::field("ypos", arrow::float32()),
    arrow::field("damage", arrow::uint16()),
    arrow::field("expire", arrow::float32()),
    arrow::field("missile_type", arrow::uint16()),
    arrow::field("turnip_face", arrow::uint16()),
    arrow::field("is_launched", arrow::uint16()),
    arrow::field("charged_power", arrow::uint16()),
    arrow::field("owner", arrow::uint8()),
  });

  FloatBuilder face_dir_b, xvel_b, yvel_b, xpos_b, ypos_b, expire_b;
  UInt8Builder state_b, owner_b;
  UInt16Builder item_type_b, damage_b, missile_type_b, turnip_face_b, is_launched_b, charged_power_b;
  UInt32Builder frame_b, spawn_id_b;
  StringBuilder match_id_b;

  for (unsigned i = 0; i < MAX_ITEMS; ++i) {
    if (s.item[i].spawn_id > MAX_ITEMS || s.item[i].num_frames == 0) {
      continue; // Skip uninitialized items
    }
    for (unsigned f = 0; f < s.item[i].num_frames; ++f) {
      match_id_b.Append(s.start_time);
      spawn_id_b.Append(s.item[i].spawn_id);
      item_type_b.Append(s.item[i].type);
      frame_b.Append(s.item[i].frame[f].frame + 123);
      state_b.Append(s.item[i].frame[f].state);
      face_dir_b.Append(s.item[i].frame[f].face_dir);
      xvel_b.Append(s.item[i].frame[f].xvel);
      yvel_b.Append(s.item[i].frame[f].yvel);
      xpos_b.Append(s.item[i].frame[f].xpos);
      ypos_b.Append(s.item[i].frame[f].ypos);
      damage_b.Append(s.item[i].frame[f].damage);
      expire_b.Append(s.item[i].frame[f].expire);

      if (MIN_VERSION(3, 2, 0)) {
        missile_type_b.Append(s.item[i].frame[f].flags_1);
        turnip_face_b.Append(s.item[i].frame[f].flags_2);
        is_launched_b.Append(s.item[i].frame[f].flags_3);
        charged_power_b.Append(s.item[i].frame[f].flags_4);
      } else {
        missile_type_b.Append(0);
        turnip_face_b.Append(0);
        is_launched_b.Append(0);
        charged_power_b.Append(0);
      }

      if (MIN_VERSION(3, 6, 0)) {
        owner_b.Append(s.item[i].frame[f].owner);
      } else {
        owner_b.Append(-1);
      }
    }
  }

  std::shared_ptr<arrow::Array> match_id_a, spawn_id_a, item_type_a, frame_a, owner_a;
  std::shared_ptr<arrow::Array> face_dir_a, xvel_a, yvel_a, xpos_a, ypos_a, damage_a, expire_a, state_a;
  std::shared_ptr<arrow::Array> missile_type_a, turnip_face_a, is_launched_a, charged_power_a;

  match_id_b.Finish(&match_id_a);
  spawn_id_b.Finish(&spawn_id_a);
  item_type_b.Finish(&item_type_a);
  frame_b.Finish(&frame_a);
  state_b.Finish(&state_a);
  face_dir_b.Finish(&face_dir_a);
  xvel_b.Finish(&xvel_a);
  yvel_b.Finish(&yvel_a);
  xpos_b.Finish(&xpos_a);
  ypos_b.Finish(&ypos_a);
  damage_b.Finish(&damage_a);
  expire_b.Finish(&expire_a);
  missile_type_b.Finish(&missile_type_a);
  turnip_face_b.Finish(&turnip_face_a);
  is_launched_b.Finish(&is_launched_a);
  charged_power_b.Finish(&charged_power_a);
  owner_b.Finish(&owner_a);

  std::shared_ptr<arrow::Table> table = arrow::Table::Make(schema, {
    match_id_a, spawn_id_a, item_type_a, frame_a, state_a,
    face_dir_a, xvel_a, yvel_a, xpos_a, ypos_a,
    damage_a, expire_a,
    missile_type_a, turnip_face_a, is_launched_a, charged_power_a,
    owner_a
  });

  try {
    std::shared_ptr<arrow::io::FileOutputStream> outfile;
    PARQUET_ASSIGN_OR_THROW(outfile, arrow::io::FileOutputStream::Open("/tmp/items.parquet"));

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



arrow::Status SlippiReplay::fodPlatformFramesAsParquet() {
  SlippiReplay s = (*this);

  uint8_t _slippi_maj = (s.slippi_version_raw >> 24) & 0xff;
  uint8_t _slippi_min = (s.slippi_version_raw >> 16) & 0xff;
  uint8_t _slippi_rev = (s.slippi_version_raw >>  8) & 0xff;

  if (!s.platform_frames.empty()) {

    using arrow::FloatBuilder;
    using arrow::UInt32Builder;
    using arrow::StringBuilder;

    std::shared_ptr<arrow::Schema> schema = arrow::schema({
      arrow::field("match_id", arrow::utf8()),
      arrow::field("frame", arrow::uint32()),
      arrow::field("left_height", arrow::float32()),
      arrow::field("right_height", arrow::float32())
    });

    FloatBuilder left_height_b;
    FloatBuilder right_height_b;
    UInt32Builder frame_b;
    StringBuilder match_id_b;

    for (size_t i = 0; i < s.platform_frames.size(); ++i) {
      const auto& e = s.platform_frames[i];
      match_id_b.Append(s.start_time);
      frame_b.Append(e.frame);
      left_height_b.Append(e.left_height);
      right_height_b.Append(e.right_height);
    }

    std::shared_ptr<arrow::Array> match_id_a, frame_a, left_height_a, right_height_a;

    match_id_b.Finish(&match_id_a);
    frame_b.Finish(&frame_a);
    left_height_b.Finish(&left_height_a);
    right_height_b.Finish(&right_height_a);

    std::shared_ptr<arrow::Table> table = arrow::Table::Make(schema, {
      match_id_a, frame_a, left_height_a, right_height_a
    });

    try {
      std::shared_ptr<arrow::io::FileOutputStream> outfile;
      PARQUET_ASSIGN_OR_THROW(outfile, arrow::io::FileOutputStream::Open("/tmp/platforms.parquet"));

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
  return arrow::Status::OK();
}

std::string SlippiReplay::settingsAsJson() {
  SlippiReplay s = (*this);

  uint8_t _slippi_maj = (s.slippi_version_raw >> 24) & 0xff;
  uint8_t _slippi_min = (s.slippi_version_raw >> 16) & 0xff;
  uint8_t _slippi_rev = (s.slippi_version_raw >>  8) & 0xff;

  std::stringstream ss;

  ss << "{\n";
  ss << "  " << JSTR("match_id"       ,s.start_time) << ",\n";
  ss << "  " << JUIN("stage"          ,s.stage) << "\n";
  ss << "}" << std::endl;

  return ss.str();
}

std::string SlippiReplay::matchSettingsAsJson(const std::string& filename) {
  SlippiReplay s = (*this);

  uint8_t _slippi_maj = (s.slippi_version_raw >> 24) & 0xff;
  uint8_t _slippi_min = (s.slippi_version_raw >> 16) & 0xff;
  uint8_t _slippi_rev = (s.slippi_version_raw >>  8) & 0xff;

  std::stringstream ss;

  ss << "{";
  ss << JSTR("match_id"       ,s.start_time) << ",";
  ss << JSTR("slp_file_name"  ,filename) << ",";
  ss << JSTR("slippi_version" ,s.slippi_version) << ",";
  ss << JUIN("timer"          ,s.timer) << ",";
  ss << JINT("frame_count"    ,s.frame_count) << ",";
  ss << JINT("winner_id"      ,s.winner_id) << ",";
  ss << JUIN("stage"          ,s.stage) << ",";
  ss << JUIN("end_type"       ,s.end_type);
  ss << " }" << std::endl;

  return ss.str();
}

std::string SlippiReplay::playerSettingsAsJson() {
  SlippiReplay s = (*this);

  uint8_t _slippi_maj = (s.slippi_version_raw >> 24) & 0xff;
  uint8_t _slippi_min = (s.slippi_version_raw >> 16) & 0xff;
  uint8_t _slippi_rev = (s.slippi_version_raw >>  8) & 0xff;

  std::stringstream ss;

  for (unsigned i = 0; i < 4; ++i) {
    if (s.player[i].player_type != 3) {
      ss << "{";
      ss << JSTR(("match_id")        ,s.start_time)             << ",";
      ss << JINT(("port")            ,i + 1)                    << ",";
      ss << JSTR(("slippi_code")     ,s.player[i].tag_code)     << ",";
      ss << JSTR(("player_tag")      ,s.player[i].tag)          << ",";
      ss << JINT(("player_type")     ,s.player[i].player_type)  << ",";
      ss << JINT(("player_index")    ,i)                        << ",";
      ss << JINT(("ext_char")        ,s.player[i].ext_char_id);
      ss << " }" << std::endl;
    }
  }
  return ss.str();
}
}
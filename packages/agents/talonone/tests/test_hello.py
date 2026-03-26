# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  https://aws.amazon.com/asl/

from app.hello import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello play_c463_z26_rzy_mar_tech.talonone"
